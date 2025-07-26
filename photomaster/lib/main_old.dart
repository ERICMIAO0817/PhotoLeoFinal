// --------------  lib/main.dart  --------------
// PhotoMaster AI  - 2025/07/26
// --------------------------------------------
import 'dart:ui'; // 用于ImageFilter
import 'dart:io'; // 用于SocketException
import 'dart:typed_data'; // 用于Uint8List
import 'dart:async';
import 'dart:convert'; // 用于jsonDecode, utf8, LineSplitter
import 'package:async/async.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:image/image.dart' as img;
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart'; // 用于 MediaType

const String kSfApiKey = 'sk-vgvnynkgjfxcacxxaxgpdykdccshljqjwqcschjrmyjvmjhh';

/// SiliconFlow 接口地址
final Uri kSfEndpoint =
    Uri.parse('https://api.siliconflow.cn/v1/chat/completions');

// 定义自定义的 OperationCanceledError 类
class OperationCanceledError implements Exception {
  @override
  String toString() => 'OperationCanceledError: The operation was canceled.';
}

// 定义自定义的 CancelableOperation 类
class CancelableOperation<T> {
  final Future<T> _future;
  bool _isCanceled = false;
  Completer<T>? _completer; // 用于桥接 Future 和取消逻辑

  CancelableOperation(this._future) {
    _completer = Completer<T>();
    _future.then((value) {
      if (!_isCanceled && !_completer!.isCompleted) {
        _completer!.complete(value);
      }
    }).catchError((error) {
      if (!_isCanceled && !_completer!.isCompleted) {
        _completer!.completeError(error);
      }
    });
  }

  // 辅助方法，用于从另一个 Future 创建 CancelableOperation
  static CancelableOperation<T> fromFuture<T>(Future<T> future) {
    return CancelableOperation(future);
  }

  Future<T> get value async {
    if (_isCanceled) {
      // 如果已取消，立即抛出自定义的取消异常
      throw OperationCanceledError();
    }
    // 返回内部 Completer 的 Future，它会反映原始 Future 的结果或被取消
    return _completer!.future;
  }

  void cancel() {
    if (!_isCanceled) {
      _isCanceled = true;
      debugPrint('Operation canceled.');
      // 如果 Completer 尚未完成，通过 completeError 抛出取消异常
      if (!_completer!.isCompleted) {
        _completer!.completeError(OperationCanceledError());
      }
    }
  }

  bool get isCanceled => _isCanceled;
  bool get isCompleted => _completer!.isCompleted; // 检查是否已完成 (无论成功或失败)
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.portraitUp,
  ]);

  final cameras = await availableCameras();
  runApp(MyApp(camera: cameras.first));
}

/// ────────── APP Root ──────────
class MyApp extends StatelessWidget {
  final CameraDescription camera;
  const MyApp({super.key, required this.camera});

  @override
  Widget build(BuildContext context) => MaterialApp(
        debugShowCheckedModeBanner: false,
        title: 'PhotoMaster AI',
        theme: ThemeData(
          colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
          useMaterial3: true,
        ),
        home: CameraScreen(camera: camera),
      );
}

class AnalysisResult {
  final String category;
  final String praise;
  final String suggestion;
  final int score;
  final bool isError;

  AnalysisResult({
    required this.category,
    required this.praise,
    required this.suggestion,
    required this.score,
    this.isError = false,
  });

  factory AnalysisResult.fromJson(Map<String, dynamic> json) {
    // 为了应对更多变的praise和suggestion格式，这里做了兼容处理
    dynamic praiseData = json['praise'];
    String praiseText = "分析出现意外";
    if (praiseData is String) {
      praiseText = praiseData;
    } else if (praiseData is List) {
      praiseText = praiseData.map((p) => p['point'] ?? '').join('; ');
    }

    dynamic suggestionData = json['suggestion'] ?? json['suggestions'];
    String suggestionText = "请稍后重试";
    if (suggestionData is String) {
      suggestionText = suggestionData;
    } else if (suggestionData is List) {
      suggestionText = suggestionData.map((s) => s['action'] ?? '').join('; ');
    }

    return AnalysisResult(
      category: json['category'] as String? ?? "未知",
      praise: praiseText,
      suggestion: suggestionText,
      score: json['score'] as int? ?? 0,
    );
  }
}

// 构图模式枚举
enum CompositionMode {
  none, // 无构图辅助线
  thirds, // 三分法构图
  diagonal, // 对角线构图
  center, // 中心构图
  // spiral, // 黄金螺旋 (可以根据需求添加，但绘制复杂)
  // leadingLines, // 引导线 (抽象表示，可根据需求添加)
}

/// ────────── Main Screen ──────────
class CameraScreen extends StatefulWidget {
  final CameraDescription camera;
  const CameraScreen({super.key, required this.camera});

  @override
  State<CameraScreen> createState() => _CameraScreenState();
}

class _CameraScreenState extends State<CameraScreen>
    with WidgetsBindingObserver {
  // ===================================
  // ====== 1. 状态变量 (State Variables) ======
  // ===================================

  CameraController? _cam;
  bool _isCameraInitialized = false;
  bool _aiOn = false;
  bool _isLiveAnalysisOn = false; // 控制实时分析开关

  // --- 修改后的拍摄后分析结果状态 ---
  // AnalysisResult? _result; // 废弃，因为新格式包含更多信息
  Map<String, dynamic>?
      _capturedAnalysisResult; // ✨ 新增：用于存储拍摄后分析的完整结果 (非流式接口返回的)
  bool _isAnalysing = false; // 拍摄后分析的加载状态
  Timer? _liveResultDisplayTimer;
  Uint8List? _lastCapturedImageBytes;

  Timer? _liveAnalysisTimer;
  // --- 实时分析的细粒度状态，用于分阶段输出 ---
  Map<String, dynamic>? _liveSuggestionData; // 实时分析的最终聚合数据，现在通过下面的细粒度变量累积
  final List<Map<String, dynamic>> _liveSuggestionsBuffer =
      []; // ✨ 新增：用于缓存分阶段接收到的实时建议
  String _liveAnalysisStatusMessage = '等待分析...'; // ✨ 新增：显示实时分析的状态消息
  String _liveAnalysisCategory = 'N/A'; // ✨ 新增：存储实时分析的类别
  String _liveAnalysisPraise = ''; // ✨ 新增：存储实时分析的最终赞扬

  bool _isAnalyzingLiveFrame = false; // 是否正在进行实时帧分析
  CancelableOperation? _currentAnalysisOperation; // 用于取消当前的流式请求 (实时分析)
  CancelableOperation? _currentCaptureAnalysisOperation; // ✨ 新增：用于取消拍摄后分析的请求

  Timer? _loadingTimer; // 用于拍摄后分析的加载动画
  int _loadingMessageIndex = 0;
  final List<String> _loadingMessages = [
    "AI 正在分析中...",
    "正在上传照片...",
    "AI 正在识别主体...",
    "AI 正在分析构图...",
    "AI 正在评估光线...",
    "即将完成...",
  ];
  final GlobalKey _compositionButtonsKey = GlobalKey();

  double _analysisCardBottomOffset = 200.0;
  double _minZoomLevel = 1.0;
  double _maxZoomLevel = 1.0;
  double _currentZoomLevel = 1.0;
  double _baseZoomLevel = 1.0;

  Offset? _focusPoint;
  bool _showFocusCircle = false;

  bool _showZoomIndicator = false;
  Timer? _zoomIndicatorTimer;

  CompositionMode _currentCompositionMode = CompositionMode.none;
  String _currentBrightnessLevel = 'N/A'; // 可用于实时和拍摄后分析
  final double previewFixedAspectRatio = 3 / 4;

  // =======================================
  // ====== 2. 生命周期方法 (Lifecycle Methods) ======
  // =======================================
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeCamera().then((_) {
      if (mounted && _isCameraInitialized) {
        if (_aiOn) {
          _startLiveAnalysisTimer();
        }
      }
    });
    WidgetsBinding.instance
        .addPostFrameCallback((_) => _calculateCardPosition());
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cam?.dispose();
    _loadingTimer?.cancel();
    _liveAnalysisTimer?.cancel();
    _zoomIndicatorTimer?.cancel();
    _currentAnalysisOperation?.cancel(); // 取消实时分析操作
    _currentCaptureAnalysisOperation?.cancel(); // ✨ 新增：取消拍摄后分析操作
    _liveResultDisplayTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final cameraController = _cam;
    if (cameraController == null) {
      if (state == AppLifecycleState.resumed) _initializeCamera();
      return;
    }
    if (state == AppLifecycleState.inactive) {
      cameraController.dispose();
      if (mounted) setState(() => _isCameraInitialized = false);
    } else if (state == AppLifecycleState.resumed) {
      _initializeCamera();
    }
  }

  void _calculateCardPosition() {
    // 通过 GlobalKey 获取构图按钮行的 RenderBox
    final RenderBox? renderBox =
        _compositionButtonsKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox != null) {
      // 获取构图按钮行的高度
      final buttonRowHeight = renderBox.size.height;
      // 获取构图按钮行在屏幕上的Y轴位置
      final buttonRowYPosition = renderBox.localToGlobal(Offset.zero).dy;
      // 获取屏幕总高度
      final screenHeight = MediaQuery.of(context).size.height;

      // 计算出构图按钮行距离屏幕底部的距离
      final bottomControlsHeight = screenHeight - buttonRowYPosition;

      // 我们希望卡片在按钮行的上方，再加一点间距（比如16像素）
      // 这里我们使用 bottomControlsHeight，它包含了按钮行自身的高度和它距离底部的所有空间
      // 这样可以确保卡片精确地出现在按钮行的正上方
      setState(() {
        _analysisCardBottomOffset = bottomControlsHeight + 16.0;
      });
    }
  }

  void _setLiveAnalysisErrorState(String message, String brightnessLevel,
      {String? details}) {
    if (mounted) {
      setState(() {
        _liveAnalysisStatusMessage = message;
        _liveSuggestionsBuffer.clear(); // 清空建议，只显示错误信息
        _liveAnalysisCategory = '错误'; // 标记类别为错误
        _liveAnalysisPraise = '';
        _currentBrightnessLevel = brightnessLevel;
        _liveSuggestionData = null; // 错误发生时清空聚合数据

        // 立即停止并清除可能的延长显示计时器，让错误信息能快速响应
        _liveResultDisplayTimer?.cancel();
        // 如果希望错误信息也短暂显示后消失，可以重新启动一个短的 _liveResultDisplayTimer
        _liveResultDisplayTimer = Timer(const Duration(seconds: 5), () {
          // 错误信息显示5秒
          if (mounted) {
            setState(() {
              _liveAnalysisStatusMessage = '等待分析...';
              _liveSuggestionsBuffer.clear();
              _liveAnalysisCategory = 'N/A';
              _liveAnalysisPraise = '';
              _currentBrightnessLevel = 'N/A';
            });
          }
        });

        debugPrint('实时分析错误状态已设置: $message, 详情: $details');
      });
    }
  }
  // ===================================
  // ====== 3. 相机控制逻辑 (Camera Control Logic) ======
  // ===================================

  /// Initializes the camera.
  Future<void> _initializeCamera() async {
    await _cam?.dispose();
    const preset = ResolutionPreset.max;
    final newController =
        CameraController(widget.camera, preset, enableAudio: false);
    try {
      await newController.initialize();
      _cam = newController;
      _minZoomLevel = await newController.getMinZoomLevel();
      _maxZoomLevel = await newController.getMaxZoomLevel();
      await newController.setFocusMode(FocusMode.auto);
      await newController.setExposureMode(ExposureMode.auto);
      if (mounted) {
        setState(() => _isCameraInitialized = true);
      }
    } catch (e) {
      debugPrint('Camera initialization failed: $e');
      if (mounted) {
        setState(() {
          // ✨ Update to use _capturedAnalysisResult and the new Map<String, dynamic> error structure
          _capturedAnalysisResult = {
            "category": "错误",
            "praise": "相机启动失败",
            "suggestions": [
              {
                "point": "系统",
                "action": "请检查相机权限或重启应用",
                "direction": "none",
                "intensity": 1,
                "reason": "初始化错误"
              }
            ],
            "isError": true // Mark this as an error
          };
        });
      }
    }
  }

  /// 处理点击对焦
  Future<void> _handleFocusTap(TapUpDetails details) async {
    final cameraController = _cam;
    if (cameraController == null || !cameraController.value.isInitialized)
      return;

    final previewBox = context.findRenderObject() as RenderBox;
    final tapPositionInBox = previewBox.globalToLocal(details.globalPosition);

    // 确保点击在预览区域内
    if (tapPositionInBox.dx < 0 ||
        tapPositionInBox.dx > previewBox.size.width ||
        tapPositionInBox.dy < 0 ||
        tapPositionInBox.dy > previewBox.size.height) return;

    final double x = tapPositionInBox.dx / previewBox.size.width;
    final double y = tapPositionInBox.dy / previewBox.size.height;

    setState(() {
      // 使用局部坐标来定位UI元素
      _focusPoint = tapPositionInBox;
      _showFocusCircle = true;
    });

    try {
      // 先锁定模式以进行精确设置
      await cameraController.setFocusMode(FocusMode.locked);
      await cameraController.setExposureMode(ExposureMode.locked);
      // 设置点位，使用归一化坐标
      await cameraController.setFocusPoint(Offset(x, y));
      await cameraController.setExposurePoint(Offset(x, y));
      // 重新设置为自动模式，让相机在需要时能再次自动对焦/测光
      await cameraController.setExposureMode(ExposureMode.auto);
      await cameraController.setFocusMode(FocusMode.auto);
    } on CameraException catch (e) {
      debugPrint('设置对焦/测光失败: $e');
    }
    // 短暂显示对焦框后自动隐藏
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _showFocusCircle = false);
    });
  }

  /// 处理缩放手势
  void _handleScaleUpdate(ScaleUpdateDetails details) {
    final cameraController = _cam;
    if (cameraController == null || !cameraController.value.isInitialized)
      return;

    final newZoom =
        (_baseZoomLevel * details.scale).clamp(_minZoomLevel, _maxZoomLevel);

    if (newZoom != _currentZoomLevel) {
      cameraController.setZoomLevel(newZoom);
    }

    // 更新UI显示缩放指示器
    _zoomIndicatorTimer?.cancel(); // 取消之前的定时器
    setState(() {
      _currentZoomLevel = newZoom;
      _showZoomIndicator = true; // 显示指示器
    });

    // 启动一个新定时器，在1.5秒后隐藏指示器
    _zoomIndicatorTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() => _showZoomIndicator = false);
      }
    });
  }

  /// 执行拍照操作
  Future<void> _shoot() async {
    final cameraController = _cam;
    if (cameraController == null || !cameraController.value.isInitialized) {
      return;
    }
    try {
      final pic = await cameraController.takePicture();
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.deepPurple,
            content: Text('Photo saved successfully to gallery',
                style: TextStyle(color: Colors.white)),
          ),
        );
      } else if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text('Failed to save photo',
                style: TextStyle(color: Colors.white)),
          ),
        );
      }
      final originalBytes = await pic.readAsBytes();
      _lastCapturedImageBytes = await _compressImage(originalBytes);

      // ✨ 修改：拍摄后分析现在统一调用 _analyse 函数
      if (_aiOn) {
        // 只有AI模式开启才进行拍摄后分析
        if (kSfApiKey.isNotEmpty) {
          // 假设kSfApiKey是用于非流式API的
          if (mounted)
            setState(() => _capturedAnalysisResult = null); // 清空旧的拍摄后结果
          await _analyse(_lastCapturedImageBytes!); // 调用拍摄后分析函数
        } else {
          if (mounted) {
            setState(() => _capturedAnalysisResult = {
                  // 使用Map来存储错误信息
                  "category": "提示",
                  "praise": "API Key未设置",
                  "suggestions": [
                    {
                      "point": "系统",
                      "action": "请在代码中填写您的kSfApiKey",
                      "direction": "none",
                      "intensity": 1,
                      "reason": "配置错误"
                    }
                  ],
                  "isError": true
                });
          }
        }
      }
    } catch (e) {
      debugPrint('An error occurred during shooting or saving: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            backgroundColor: Colors.redAccent,
            content: Text('Operation failed. Please check permissions.',
                style: TextStyle(color: Colors.white)),
          ),
        );
      }
    }
  }

  // ===================================
  // ====== 4. AI 分析逻辑 (AI Analysis Logic) ======
  // ===================================

  /// 启动实时分析定时器
  void _startLiveAnalysisTimer() {
    _liveAnalysisTimer?.cancel(); // 先取消之前的定时器

    // 只有当AI总开关和实时分析开关都开启时才启动定时器
    if (_aiOn && _isLiveAnalysisOn) {
      // ✨ 增加了对 _isLiveAnalysisOn 的检查
      _liveAnalysisTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
        if (!_isAnalyzingLiveFrame) {
          // 只有当前没有分析任务时才触发新的分析
          _captureAndAnalyzeFrame(); // 调用实时分析函数
        }
      });
      debugPrint("实时分析定时器已启动。");
    } else {
      debugPrint("实时分析定时器已停止。");
      // 停止时清空所有实时分析相关的状态
      if (mounted) {
        setState(() {
          _liveSuggestionsBuffer.clear(); // 清空实时建议缓存
          _liveAnalysisStatusMessage = '已停止'; // 更新状态消息
          _liveAnalysisCategory = 'N/A';
          _liveAnalysisPraise = '';
          _currentBrightnessLevel = 'N/A';
          _liveSuggestionData = null; // 可选，如果这个变量用于实时分析的最终聚合
          _isAnalyzingLiveFrame = false; // 确保分析状态重置
          _currentAnalysisOperation?.cancel(); // 取消可能正在进行的实时分析请求
          _liveResultDisplayTimer?.cancel();
          debugPrint('实时分析结果显示计时器已取消。');
        });
      }
    }
  }

  /// 捕获帧并发送给后端进行实时分析
  Future<void> _captureAndAnalyzeFrame() async {
    if (_cam == null || !_cam!.value.isInitialized) return;

    // 确保AI总开关和实时分析开关都开启
    if (!_aiOn || !_isLiveAnalysisOn) {
      debugPrint("AI模式或实时分析开关未开启，不进行实时分析。");
      return;
    }

    // 如果存在未完成的实时分析请求，先取消它
    if (_currentAnalysisOperation != null &&
        !_currentAnalysisOperation!.isCanceled) {
      // 检查isCanceled确保操作未真正完成，而只是被标记取消
      debugPrint("存在未完成的实时分析请求，先取消它。");
      _currentAnalysisOperation!.cancel();
    }

    // 取消任何前一个结果的延长显示计时器，因为现在有新分析要开始
    _liveResultDisplayTimer?.cancel();

    // 立即更新UI状态，表示分析开始
    setState(() {
      _isAnalyzingLiveFrame = true; // 标志为正在分析中
      _liveSuggestionsBuffer.clear(); // 清空之前的建议缓存
      _liveAnalysisStatusMessage = '正在准备图片...'; // 初始状态消息
      _liveAnalysisCategory = 'N/A'; // 重置类别
      _liveAnalysisPraise = ''; // 重置赞扬
      _currentBrightnessLevel = '分析中...'; // 亮度状态
      _liveSuggestionData = null; // 清空旧的聚合数据
    });

    try {
      // 捕获和压缩图片
      await _cam!.setFlashMode(FlashMode.off);
      final pic = await _cam!.takePicture();
      final imageBytes = await pic.readAsBytes();
      final compressedBytes = await _compressImage(imageBytes);

      debugPrint('图片压缩完成，大小: ${compressedBytes.length} bytes');

      // ✨ 关键修复：确保 URI 字符串纯净，避免 FormatException
      // 建议将 URL 存储在常量中，并确保其没有隐藏字符。
      const String backendStreamUri =
          'http://192.168.50.133:5002/api/analyze_stream';
      // 如果 IP 可能会变，请确保这个字符串是正确的，或者从配置中读取
      // final uri = Uri.parse(backendStreamUri.trim()); // 如果担心外部来源的URL，可以加上 .trim()
      final uri = Uri.parse(backendStreamUri);
      debugPrint('准备发送请求到: $uri');

      var request = http.MultipartRequest('POST', uri);
      var multipartFile = http.MultipartFile.fromBytes(
        'image',
        compressedBytes,
        filename: 'upload.jpg',
        contentType: MediaType('image', 'jpeg'), // 明确MIME类型
      );
      request.files.add(multipartFile);

      debugPrint('请求已发出，等待流式响应...');

      final streamedResponseFuture = request.send();
      _currentAnalysisOperation =
          CancelableOperation.fromFuture(streamedResponseFuture);

      var streamedResponse = await _currentAnalysisOperation!.value;

      // 检查操作是否在等待响应过程中被取消
      if (_currentAnalysisOperation!.isCanceled) {
        debugPrint('实时分析请求在响应前被取消。');
        return; // 直接返回，不进行后续处理或错误报告
      }

      if (streamedResponse.statusCode == 200) {
        debugPrint('HTTP 200 成功响应，开始监听流...');
        await for (var chunk in streamedResponse.stream
            .transform(utf8.decoder)
            .transform(const LineSplitter())) {
          if (_currentAnalysisOperation!.isCanceled) {
            debugPrint('流处理过程中，操作被取消。');
            break; // 跳出循环，停止处理流
          }

          if (chunk.startsWith('data:')) {
            try {
              final String jsonData = chunk.substring(5).trim();
              final Map<String, dynamic> eventData = jsonDecode(jsonData);
              final String eventType = eventData['type'] ?? 'unknown';

              debugPrint('收到事件类型: $eventType, 数据: $eventData');

              setState(() {
                switch (eventType) {
                  case 'status':
                    _liveAnalysisStatusMessage =
                        eventData['message'] ?? '处理中...';
                    break;
                  case 'initial_analysis':
                    _liveAnalysisCategory = eventData['category'] ?? 'N/A';
                    _liveAnalysisStatusMessage = '已完成基础分析。';
                    final analysis = eventData['analysis'];
                    if (analysis != null) {
                      _currentBrightnessLevel =
                          analysis['brightness'] as String? ?? 'N/A';
                    }
                    break;
                  case 'suggestion_update':
                    final suggestion = eventData['suggestion'];
                    if (suggestion != null &&
                        suggestion is Map<String, dynamic>) {
                      _liveSuggestionsBuffer.add(suggestion);
                      _liveAnalysisStatusMessage =
                          '正在生成第${_liveSuggestionsBuffer.length}条建议...';
                    }
                    break;
                  case 'final_praise':
                    _liveAnalysisPraise = eventData['praise'] ?? '';
                    _liveAnalysisStatusMessage = '分析完成，等待查看。';
                    break;
                  case 'error':
                    // ✨ 统一错误处理：调用辅助方法
                    _setLiveAnalysisErrorState(
                      '错误: ${eventData['message'] ?? '未知错误'}',
                      _currentBrightnessLevel, // 保持当前亮度状态，或者设为'错误'
                      details: eventData['details'],
                    );
                    break; // 收到错误后可以考虑跳出循环
                  case 'end':
                    debugPrint('SSE Stream ended.');
                    _liveSuggestionData = {
                      // 聚合最终结果
                      "category": _liveAnalysisCategory,
                      "praise": _liveAnalysisPraise,
                      "analysis": {"brightness": _currentBrightnessLevel},
                      "suggestions": _liveSuggestionsBuffer.toList()
                    };
                    // 不需要在这里清除 _liveSuggestionsBuffer，因为 _liveResultDisplayTimer 会负责
                    break;
                  default:
                    debugPrint('Unknown event type: $eventType');
                    break;
                }
              });
            } on FormatException catch (e) {
              // ✨ 统一错误处理：调用辅助方法
              _setLiveAnalysisErrorState(
                '数据解析错误。',
                '错误',
                details: 'SSE Data Format Error: $e, Chunk: $chunk',
              );
            }
          }
        }
      } else {
        // HTTP 响应非 200 的错误处理
        _setLiveAnalysisErrorState(
          '服务器连接失败 (${streamedResponse.statusCode})',
          '失败',
          details: 'Reason: ${streamedResponse.reasonPhrase}',
        );
      }
    } on OperationCanceledError {
      debugPrint('实时分析操作被取消。');
      // ✨ 此时不需要设置错误状态，因为这是预期行为
      // 状态已经在调用 cancel() 前的 setState 中被清空，或由新请求覆盖
    } on TimeoutException catch (e) {
      // ✨ 统一错误处理：调用辅助方法
      _setLiveAnalysisErrorState('请求超时。', '超时', details: e.toString());
    } on SocketException catch (e) {
      // ✨ 统一错误处理：调用辅助方法
      _setLiveAnalysisErrorState('网络连接失败。', '无网络', details: e.message);
    } catch (e) {
      // ✨ 统一错误处理：调用辅助方法
      _setLiveAnalysisErrorState('发生未知错误。', '错误', details: e.toString());
    } finally {
      _currentAnalysisOperation = null; // 清除操作引用
      if (mounted) {
        setState(() {
          _isAnalyzingLiveFrame = false; // 分析过程结束，允许新的分析开始
        });
        // UI数据的清理和面板消失由 _liveResultDisplayTimer 负责，不在finally中直接进行
      }
    }
  }

  Future<void> _analyse(Uint8List jpg) async {
    final stopwatch = Stopwatch()..start();

    // 如果有正在进行的拍摄后分析，先取消它
    if (_currentCaptureAnalysisOperation != null &&
        !_currentCaptureAnalysisOperation!.isCanceled) {
      debugPrint("存在未完成的拍摄后分析请求，先取消它。");
      _currentCaptureAnalysisOperation!.cancel();
    }

    if (mounted) {
      setState(() {
        _isAnalysing = true; // 标识拍摄后分析正在进行
        _capturedAnalysisResult = null; // 清空旧结果
        _loadingMessageIndex = 0; // 重置加载消息索引
      });
      // 启动加载动画定时器
      _loadingTimer?.cancel(); // 确保取消之前的
      _loadingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
        if (!_isAnalysing) {
          // 如果分析结束，停止定时器
          timer.cancel();
          return;
        }
        setState(() {
          _loadingMessageIndex =
              (_loadingMessageIndex + 1) % _loadingMessages.length;
        });
      });
    }

    final Map<String, dynamic> payload = {
      'model': 'MiniMaxAI/MiniMax-M1-80k', // 假设后端使用此模型
      'temperature': 0.5,
      'max_tokens': 400, // 增加 max_tokens 以允许后端AI输出更多内容
      'messages': [
        {
          'role': 'system',
          'content': '''
你是一位充满激情、善于鼓励的摄影导师。你的任务是分析一张用户拍摄的照片，并以JSON格式返回你的分析报告。

请遵循以下思考步骤：
1.  **识别类别**: 首先，判断这张照片的主要类别是什么？从 ["风景", "人像", "美食", "静物", "宠物", "建筑", "夜景", "街拍"] 中选择一个最贴切的。
2.  **核心优势**: 找出照片最值得肯定的1-2个优点。
3.  **关键提升点**: 找出对画面改善最明显的2-3个问题，并根据识别出的类别，提供针对性的建议。
4.  **行动指令**: 针对每个关键提升点，给出1句具体的、小白也能立刻执行的行动指令。

现在，请将你的分析报告严格按照以下JSON格式输出。
你的整个回复必须是一个能够直接被程序解析的、纯净的JSON对象。
不要在JSON前后添加任何包括“好的”、“这是您要的分析”在内的解释性文字、注释或Markdown标记 (例如```json)。

{
  "category": "识别出的类别",
  "praise": "这里是核心优势的总结",
  "suggestions": [ // ✨ 修改这里：为拍摄后分析也期望 suggestions 数组
    {"point": "构图", "action": "将主体移到三分线上"},
    {"point": "光线", "action": "找到更亮的地方"},
    // ... 可以有更多建议
  ]
}
'''
        },
        {
          'role': 'user',
          'content': [
            {
              'type': 'image_url',
              'image_url': {
                'url': 'data:image/jpeg;base64,${base64Encode(jpg)}'
              }
            },
            {'type': 'text', 'text': '请分析这张照片'}
          ]
        }
      ]
    };

    Map<String, dynamic>? finalResultData; // 使用 Map<String, dynamic> 来存储结果

    try {
      debugPrint("--- 拍摄后AI分析计时开始 ---");

      // ✨ 调用非流式 API
      final uri = Uri.parse(
          '[http://192.168.50.133:5002/api/analyze](http://192.168.50.133:5002/api/analyze)'); // 非流式 API 端点

      // 构建请求体，包含AI模型Prompt和图片
      var request = http.MultipartRequest('POST', uri)
        ..fields['payload'] = jsonEncode(payload) // 将AI Prompt作为payload字段发送
        ..files.add(http.MultipartFile.fromBytes(
          'image',
          jpg,
          filename: 'photo.jpg',
          contentType: MediaType('image', 'jpeg'),
        ));

      // 使用 CancelableOperation 包装请求
      _currentCaptureAnalysisOperation = CancelableOperation.fromFuture(
          request.send().timeout(const Duration(seconds: 30)));

      var streamedResponse = await _currentCaptureAnalysisOperation!.value;

      if (_currentCaptureAnalysisOperation!.isCanceled) {
        debugPrint('拍摄后分析请求在响应前被取消。');
        return;
      }

      debugPrint('收到拍摄后分析响应状态码: ${streamedResponse.statusCode}');
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        debugPrint('HTTP 200 成功响应');
        final rawBody = utf8.decode(response.bodyBytes);
        debugPrint('原始响应体: $rawBody');

        final outerData = jsonDecode(rawBody) as Map<String, dynamic>;
        if (outerData['status'] == 'success' && outerData.containsKey('data')) {
          final innerJsonString = outerData['data'] as String;
          final innerData = jsonDecode(innerJsonString) as Map<String, dynamic>;

          finalResultData = innerData; // 存储后端返回的完整数据
        } else {
          debugPrint(
              'API返回成功状态码200，但业务逻辑失败。状态: ${outerData['status'] ?? '未知状态'}, 消息: ${outerData['message'] ?? '无'}');
          finalResultData = {
            "category": "API异常",
            "praise": "后端业务逻辑错误",
            "suggestions": [
              {
                "point": "系统",
                "action": outerData['message'] ?? '无',
                "direction": "none",
                "intensity": 1,
                "reason": "后端返回异常"
              }
            ],
            "isError": true
          };
        }
      } else {
        debugPrint(
            'HTTP 响应非 200: ${response.statusCode}, Reason: ${response.reasonPhrase}');
        finalResultData = {
          "category": "分析失败",
          "praise": "服务器错误",
          "suggestions": [
            {
              "point": "系统",
              "action":
                  "错误码: ${response.statusCode}, 详情: ${response.reasonPhrase ?? '无'}",
              "direction": "none",
              "intensity": 1,
              "reason": "HTTP错误"
            }
          ],
          "isError": true
        };
      }
    } on OperationCanceledError {
      debugPrint('拍摄后分析操作被取消。');
      finalResultData = {
        "category": "分析取消",
        "praise": "操作已取消",
        "suggestions": [
          {
            "point": "系统",
            "action": "拍摄后分析请求被取消",
            "direction": "none",
            "intensity": 1,
            "reason": "用户操作或新请求"
          }
        ],
        "isError": true
      };
    } on TimeoutException catch (e) {
      debugPrint('请求超时异常: $e');
      finalResultData = {
        "category": "请求超时",
        "praise": "服务器未响应",
        "suggestions": [
          {
            "point": "系统",
            "action": "请检查网络或服务器负载",
            "direction": "none",
            "intensity": 1,
            "reason": "网络超时"
          }
        ],
        "isError": true
      };
    } on SocketException catch (e) {
      debugPrint('网络连接异常（SocketException）: $e');
      finalResultData = {
        "category": "网络失败",
        "praise": "无法连接到服务器",
        "suggestions": [
          {
            "point": "系统",
            "action": "请检查网络连接",
            "direction": "none",
            "intensity": 1,
            "reason": "网络连接错误"
          }
        ],
        "isError": true
      };
    } catch (e) {
      debugPrint('拍摄后分析发生未知异常: $e');
      finalResultData = {
        "category": "未知错误",
        "praise": "分析时发生意外",
        "suggestions": [
          {
            "point": "系统",
            "action": "请重试或联系支持",
            "direction": "none",
            "intensity": 1,
            "reason": "未知异常"
          }
        ],
        "isError": true
      };
    } finally {
      stopwatch.stop();
      debugPrint("--- 拍摄后AI分析总耗时: ${stopwatch.elapsedMilliseconds}ms ---");
      _loadingTimer?.cancel(); // 停止加载动画
      if (mounted) {
        setState(() {
          _capturedAnalysisResult = finalResultData; // 更新最终结果到状态变量
          _isAnalysing = false; // 重置分析状态
        });
      }
      _currentCaptureAnalysisOperation = null; // 清除操作引用
    }
  }

  String _extractPureJson(String rawText) {
    final cleaned = rawText.trim().replaceAll(RegExp(r'```json|```'), '');
    final match = RegExp(r'{[\s\S]*}').firstMatch(cleaned);
    return match?.group(0) ?? '';
  }

  /// 重新尝试分析（当上次分析失败时）
  void _retryAnalysis() {
    if (_lastCapturedImageBytes != null) {
      setState(() => _capturedAnalysisResult =
          null); // ✨ Update to clear _capturedAnalysisResult
      _analyse(_lastCapturedImageBytes!);
    }
  }

  // ===================================
  // ====== 5. 图像处理辅助方法 (Image Processing Helpers) ======
  // ===================================

  /// 压缩图片
  Future<Uint8List> _compressImage(Uint8List bytes) async {
    final stopwatch = Stopwatch()..start();
    img.Image? image = img.decodeImage(bytes);
    if (image == null) return bytes;

    img.Image resizedImage = (image.width > image.height)
        ? img.copyResize(image, width: 512)
        : img.copyResize(image, height: 512);

    final result = Uint8List.fromList(img.encodeJpg(resizedImage, quality: 65));
    stopwatch.stop();
    debugPrint("--- 图像压缩耗时: ${stopwatch.elapsedMilliseconds}ms ---");
    return result;
  }

  // ===================================
  // ====== 6. UI 构建方法 (UI Building Methods) ======
  // ===================================

  @override
  Widget build(BuildContext context) {
    if (!_isCameraInitialized || _cam == null) {
      return const Scaffold(
          backgroundColor: Colors.black,
          body: Center(child: CircularProgressIndicator()));
    }
    return Scaffold(
      backgroundColor: Colors.black,
      body: _buildCameraView(),
    );
  }

  /// 构建相机预览界面及其叠加层
  Widget _buildCameraView() {
    final cameraController = _cam!;
    return Stack(
      children: [
        // --- Layer 1: 相机预览、手势检测、构图辅助线 ---
        _buildCameraPreviewLayer(cameraController),
        // --- Layer 2: 缩放级别指示器 ---
        _buildZoomIndicator(),
        // --- Layer 3: 顶部控制区 ---
        _buildTopControls(),
        // --- Layer 4: 分析卡片 ---
        _buildAnalysisCard(context),
        // --- Layer 5: 底部控制栏 ---
        _buildBottomControls(),
        // --- Layer 6: 实时教练面板 ---
        _buildLiveCoachPanel(),
        // --- Layer 7: 加载指示器 (在顶部) ---
        _buildLoadingIndicator(),
      ],
    );
  }

// --- Layer 1: 相机预览、手势检测、构图辅助线 ---
  Widget _buildCameraPreviewLayer(CameraController cameraController) {
    return Positioned.fill(
      child: LayoutBuilder(
        builder: (BuildContext context, BoxConstraints constraints) {
          double widgetWidth = constraints.maxWidth;
          double widgetHeight = constraints.maxHeight;

          double previewWidth;
          double previewHeight;

          if (widgetWidth / widgetHeight > previewFixedAspectRatio) {
            previewHeight = widgetHeight;
            previewWidth = previewHeight * previewFixedAspectRatio;
          } else {
            previewWidth = widgetWidth;
            previewHeight = previewWidth / previewFixedAspectRatio;
          }

          final double offsetX = (constraints.maxWidth - previewWidth) / 2;
          final double offsetY = (constraints.maxHeight - previewHeight) / 2;

          return Positioned(
            left: offsetX,
            top: offsetY,
            width: previewWidth,
            height: previewHeight,
            child: GestureDetector(
              onTapUp: _handleFocusTap,
              onScaleStart: (details) => _baseZoomLevel = _currentZoomLevel,
              onScaleUpdate: _handleScaleUpdate,
              child: Stack(
                children: [
                  // 相机预览画面
                  Positioned.fill(
                    child: ClipRect(
                      child: FittedBox(
                        fit: BoxFit.cover,
                        child: SizedBox(
                          width: cameraController.value.previewSize!.height,
                          height: cameraController.value.previewSize!.width,
                          child: CameraPreview(cameraController),
                        ),
                      ),
                    ),
                  ),
                  // 构图辅助线绘制
                  Positioned.fill(
                    child: CustomPaint(
                      painter: CompositionLinesPainter(
                        compositionMode: _currentCompositionMode,
                      ),
                    ),
                  ),
                  // 对焦框UI
                  if (_focusPoint != null)
                    Positioned(
                      top: _focusPoint!.dy - 40,
                      left: _focusPoint!.dx - 40,
                      child: AnimatedOpacity(
                        opacity: _showFocusCircle ? 1.0 : 0.0,
                        duration: const Duration(milliseconds: 300),
                        curve: Curves.easeOut,
                        child: Container(
                          height: 80,
                          width: 80,
                          decoration: BoxDecoration(
                            border: Border.all(color: Colors.white, width: 2),
                            shape: BoxShape.circle,
                          ),
                        ),
                      ),
                    ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // --- Layer 2: 缩放级别指示器 ---
  Widget _buildZoomIndicator() {
    return Center(
      child: AnimatedOpacity(
        opacity: _showZoomIndicator ? 1.0 : 0.0,
        duration: const Duration(milliseconds: 200),
        curve: Curves.easeOut,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: Colors.black.withOpacity(0.5),
            borderRadius: BorderRadius.circular(50),
          ),
          child: Text(
            '${_currentZoomLevel.toStringAsFixed(1)}x',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ),
      ),
    );
  }

  // --- Layer 3: 顶部控制区 ---
  Widget _buildTopControls() {
    return Positioned(
      bottom: 80.0 + MediaQuery.of(context).padding.top,
      left: 0,
      right: 0,
      child: Column(
        children: [
          // 顶部控制区内部依然可以调用其他更小的构建方法
          _buildCompositionButtons(),
          const SizedBox(height: 8),
          // // 实时光线提示
          // Row(
          //   mainAxisAlignment: MainAxisAlignment.center,
          //   children: [
          //     if (_aiOn &&
          //         _liveSuggestionData != null &&
          //         _liveSuggestionData!['analysis'] != null)
          //       Padding(
          //         padding: const EdgeInsets.symmetric(horizontal: 4.0),
          //         child: Container(
          //           padding:
          //               const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          //           decoration: BoxDecoration(
          //             color: Colors.white.withOpacity(0.5),
          //             borderRadius: BorderRadius.circular(20),
          //           ),
          //           child: Text(
          //             '光线: ${_liveSuggestionData!['analysis']['brightness'] ?? 'N/A'}',
          //             style: TextStyle(
          //               color: _getBrightnessColor(
          //                   _liveSuggestionData!['analysis']['brightness'] ??
          //                       'N/A'),
          //               fontSize: 13,
          //               fontWeight: FontWeight.bold,
          //             ),
          //           ),
          //         ),
          //       ),
          //   ],
          // ),
        ],
      ),
    );
  }

  /// 构建构图模式选择按钮组
  String _getCompositionModeName(CompositionMode mode) {
    switch (mode) {
      case CompositionMode.none:
        return '无';
      case CompositionMode.thirds:
        return '三分';
      case CompositionMode.diagonal:
        return '对角';
      case CompositionMode.center:
        return '中心';
      default:
        return '';
    }
  }

  Widget _buildCompositionButtons() {
    final List<Map<String, dynamic>> modes = [
      {
        'mode': CompositionMode.none,
        'label': '无',
        'tip': '街景、人文或情绪图像时，自由发挥与灵感记录',
      },
      {
        'mode': CompositionMode.thirds,
        'label': '三分',
        'tip': '风景、人像或静物时将主体放在三分交点，更自然有张力',
      },
      {
        'mode': CompositionMode.diagonal,
        'label': '对角',
        'tip': '街拍、建筑或引导线场景元素沿对角线排列，',
      },
      {
        'mode': CompositionMode.center,
        'label': '中心',
        'tip': '特写、人像或正面建筑时将主体居中，画面简洁有力量',
      },
    ];

    final selectedEntry = modes.firstWhere(
      (entry) => entry['mode'] == _currentCompositionMode,
      orElse: () => modes[0],
    );

    return Container(
      key: _compositionButtonsKey,
      color: Colors.black.withOpacity(0),
      padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // 第一行：按钮
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: modes.map((entry) {
              final mode = entry['mode'] as CompositionMode;
              final selected = _currentCompositionMode == mode;
              return Expanded(
                child: GestureDetector(
                  onTap: () {
                    setState(() => _currentCompositionMode = mode);
                  },
                  child: Container(
                    height: 36,
                    margin: const EdgeInsets.symmetric(horizontal: 4),
                    decoration: BoxDecoration(
                      color: selected
                          ? Colors.white.withOpacity(0.1)
                          : Colors.black.withOpacity(0.1),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white54, width: 1),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      entry['label'],
                      style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: selected ? Colors.black : Colors.white,
                        fontSize: 14,
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          ),
          const SizedBox(height: 8),
          // 第二行：提示语
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4.0),
            child: Text(
              selectedEntry['tip']!,
              textAlign: TextAlign.center,
              style: const TextStyle(
                color: Colors.white70,
                fontSize: 12,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- Layer 4: 分析卡片 (显示拍摄后分析结果) ---
  Widget _buildAnalysisCard(BuildContext context) {
    // 只有当 _capturedAnalysisResult 不为空且没有错误时才显示卡片
    final bool isCardVisible = _capturedAnalysisResult != null &&
        !(_capturedAnalysisResult!['isError'] ?? false); // 假设isError用于标记后端或解析错误

    // 从 _capturedAnalysisResult 中安全地获取数据
    // category、praise 是直接的字符串，suggestions 是一个列表
    final String category = _capturedAnalysisResult?['category'] ?? '分析结果';
    final String praise = _capturedAnalysisResult?['praise'] ?? ''; // 赞扬可能为空
    final List<dynamic> suggestions =
        _capturedAnalysisResult?['suggestions'] ?? [];
    final bool hasError = _capturedAnalysisResult?['isError'] ?? false; // 错误状态

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      // 卡片位置：可见时在偏移量，不可见时在屏幕下方隐藏
      bottom: isCardVisible ? _analysisCardBottomOffset : -300,
      left: 16,
      right: 16,
      child: GestureDetector(
        // 下滑关闭手势
        onVerticalDragEnd: (details) {
          if (details.primaryVelocity != null &&
              details.primaryVelocity! > 10) {
            // 检测向下滑动
            setState(() => _capturedAnalysisResult = null); // 关闭卡片
          }
        },
        // 左滑关闭手势
        onHorizontalDragEnd: (details) {
          if (details.primaryVelocity != null &&
              details.primaryVelocity! < -100) {
            // 检测向左滑动
            setState(() => _capturedAnalysisResult = null); // 关闭卡片
          }
        },
        child: Stack(
          clipBehavior: Clip.none, // 允许提示超出边界
          children: [
            // 主要的卡片内容，传入从 _capturedAnalysisResult 解析出的数据
            _buildCardContentForCapturedAnalysis(
              category: category,
              praise: praise,
              suggestions: suggestions,
              isError: hasError,
              onRetry: _retryAnalysis, // 拍照后分析的重试按钮
            ),

            // 下滑关闭的提示
            _buildBottomDismissHint(),
          ],
        ),
      ),
    );
  }

  /// ✨ MODIFIED & RENAMED: 构建拍摄后分析卡片的主体内容
  Widget _buildCardContentForCapturedAnalysis({
    required String category,
    required String praise,
    required List<dynamic> suggestions, // 现在接收一个列表
    required bool isError,
    required VoidCallback onRetry,
  }) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(24),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 3.0, sigmaY: 3.0),
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.15),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              // 类别/标题
              Text(
                category,
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: isError
                      ? Colors.red.shade400 // 错误时显示红色
                      : Colors.white,
                ),
              ),
              const Divider(height: 12, color: Colors.white24),

              // 赞扬内容
              if (praise.isNotEmpty) ...[
                Text("👍 优点: $praise",
                    style: const TextStyle(fontSize: 14, color: Colors.white)),
                const SizedBox(height: 6),
              ],

              // ✨ 多条建议列表
              if (suggestions.isNotEmpty)
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: suggestions.map<Widget>((s) {
                    final String point = s['point'] ?? '要点';
                    final String action = s['action'] ?? '无具体行动建议';
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4.0),
                      child: Text(
                        "👉 $point: $action", // 格式化显示 "要点: 具体行动"
                        style:
                            const TextStyle(fontSize: 14, color: Colors.white),
                      ),
                    );
                  }).toList(),
                )
              else if (!isError) // 如果没有建议但也不是错误（例如AI认为照片很完美，无需建议）
                const Text("暂无具体建议，但照片表现良好。",
                    style: TextStyle(fontSize: 14, color: Colors.white70)),

              // 错误时显示重试按钮
              if (isError) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: onRetry,
                    icon: const Icon(Icons.refresh, size: 18),
                    label: const Text("重试"),
                    style: ElevatedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        backgroundColor: Colors.white.withOpacity(0.2),
                        foregroundColor: Colors.white,
                        textStyle: const TextStyle(fontSize: 14)),
                  ),
                )
              ],
              // 为下滑关闭提示留出空间
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  /// ✨ NEW: 构建左侧的关闭提示
  Widget _buildLeftDismissHint() {
    return Positioned(
      left: -28, // 将提示稍微移出卡片边界，视觉上更突出
      top: 0,
      bottom: 0,
      child: Center(
        child: IgnorePointer(
          // 让提示本身不响应点击，避免干扰手势
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.black.withOpacity(0.4),
              borderRadius: const BorderRadius.only(
                topRight: Radius.circular(12),
                bottomRight: Radius.circular(12),
              ),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "左",
                  style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
                Text(
                  "滑",
                  style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
                SizedBox(height: 4),
                Icon(Icons.chevron_left, color: Colors.white70, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }

  /// ✨ NEW: 构建底部的关闭提示
  Widget _buildBottomDismissHint() {
    return Positioned(
      bottom: -10, // 将提示稍微移出卡片边界
      left: 0,
      right: 0,
      child: Center(
        child: IgnorePointer(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  "下滑关闭",
                  style: TextStyle(
                      color: Colors.white70,
                      fontSize: 12,
                      fontWeight: FontWeight.bold),
                ),
                Icon(Icons.keyboard_arrow_down,
                    color: Colors.white70, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }

// --- Layer 5: 底部控制栏 --- (AI开关、拍照按钮、缩略图、实时分析触发按钮)
  Widget _buildBottomControls() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: SafeArea(
        top: false,
        child: Container(
          padding: const EdgeInsets.only(bottom: 6, top: 6),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // AI模式切换按钮 (保持不变)
              ToggleButtons(
                isSelected: [_aiOn, !_aiOn],
                onPressed: (index) {
                  setState(() {
                    _aiOn = (index == 0);
                    if (_aiOn) {
                      // 当AI总开关打开时，如果实时分析开关已经打开，则启动定时器
                      if (_isLiveAnalysisOn) {
                        _startLiveAnalysisTimer();
                      }
                    } else {
                      // 当AI总开关关闭时，取消所有实时分析相关的状态和定时器
                      _liveAnalysisTimer?.cancel();
                      _liveSuggestionData = null;
                      _isAnalyzingLiveFrame = false;
                      _loadingTimer?.cancel(); // 确保加载动画也停止
                      _loadingMessageIndex = 0; // 重置加载消息
                      _isLiveAnalysisOn = false; // AI总开关关闭时，实时分析开关也应关闭
                      _currentAnalysisOperation?.cancel(); // 取消可能正在进行的分析
                    }
                  });
                },
                borderRadius: BorderRadius.circular(30),
                selectedColor: Colors.black,
                color: Colors.white,
                fillColor: Colors.white,
                splashColor: Colors.white.withOpacity(0.4),
                borderColor: Colors.white70,
                selectedBorderColor: Colors.white,
                constraints:
                    const BoxConstraints(minHeight: 36.0, minWidth: 100.0),
                children: const [
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16.0),
                    child: Text("AI 建议",
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                  Padding(
                    padding: EdgeInsets.symmetric(horizontal: 16.0),
                    child: Text("自由拍摄",
                        style: TextStyle(fontWeight: FontWeight.bold)),
                  ),
                ],
              ),

              const SizedBox(height: 12),

              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 40.0),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // 缩略图 (保持不变)
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: Colors.white, width: 1.5),
                      ),
                      child: _lastCapturedImageBytes != null
                          ? ClipRRect(
                              borderRadius: BorderRadius.circular(8),
                              child: Image.memory(
                                _lastCapturedImageBytes!,
                                fit: BoxFit.cover,
                              ),
                            )
                          : const Icon(Icons.photo_size_select_actual_outlined,
                              color: Colors.white, size: 24),
                    ),
                    // 快门按钮 (保持不变)
                    SizedBox(
                      width: 60,
                      height: 60,
                      child: FloatingActionButton(
                        onPressed: _shoot,
                        backgroundColor: Colors.white,
                        elevation: 4.0,
                        child: const Icon(Icons.camera_alt,
                            color: Colors.black, size: 30),
                      ),
                    ),
                    // 实时分析开关按钮 (主要修改在这里)
                    GestureDetector(
                      // 只有当AI总开关打开时，这个实时分析开关才可交互
                      onTap: _aiOn
                          ? () {
                              setState(() {
                                // 切换实时分析开关状态
                                _isLiveAnalysisOn = !_isLiveAnalysisOn;

                                if (_isLiveAnalysisOn) {
                                  // 如果打开实时分析，则启动定时器进行周期性分析
                                  _startLiveAnalysisTimer(); // 假设这个方法会定期调用 _captureAndAnalyzeFrame
                                  debugPrint('实时分析已开启');
                                } else {
                                  // 如果关闭实时分析，则取消定时器，并清除当前分析结果
                                  _liveAnalysisTimer?.cancel();
                                  _currentAnalysisOperation
                                      ?.cancel(); // 取消可能正在进行的分析
                                  _liveSuggestionData = null; // 清除现有建议
                                  _isAnalyzingLiveFrame = false; // 重置分析状态
                                  _loadingTimer?.cancel(); // 停止加载动画
                                  _loadingMessageIndex = 0; // 重置加载消息
                                  debugPrint('实时分析已关闭');
                                }
                              });
                            }
                          : null, // 如果_aiOn为false，则禁用点击事件
                      child: Container(
                        width: 60, // 稍微增大宽度以容纳文字
                        height: 60, // 稍微增大高度以容纳文字
                        decoration: BoxDecoration(
                          color: _aiOn
                              ? (_isLiveAnalysisOn // 如果AI模式开启，根据实时分析开关状态决定颜色
                                  ? (_isAnalyzingLiveFrame // 如果实时分析开启且正在分析中
                                      ? Colors.yellow
                                          .withOpacity(0.8) // 分析中显示黄色半透明
                                      : Colors.yellow) // 实时分析开启，显示纯黄色
                                  : Colors.grey.withOpacity(0.5)) // 实时分析关闭，显示灰色
                              : Colors.grey
                                  .withOpacity(0.3), // AI总开关关闭，显示更浅的灰色且不可交互
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _aiOn
                                ? (_isLiveAnalysisOn
                                    ? (_isAnalyzingLiveFrame
                                        ? Colors.white // 分析中显示白色边框
                                        : Colors.white70) // 实时分析开启，显示白色边框
                                    : Colors.transparent) // 实时分析关闭时不显示边框
                                : Colors.transparent, // AI总开关关闭时不显示边框
                            width: 1.5,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.3),
                              spreadRadius: 1,
                              blurRadius: 3,
                              offset: const Offset(0, 1),
                            ),
                          ],
                        ),
                        // 按钮内部的内容：根据状态显示图标或图标+文字
                        child:
                            _aiOn && _isLiveAnalysisOn && _isAnalyzingLiveFrame
                                ? Column(
                                    // 使用Column堆叠内容
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(
                                        Icons.insights, // 分析图标
                                        size: 24, // 适当缩小图标大小以适应文字
                                        color: Colors.black, // 黄色背景下用黑色图标
                                      ),
                                      SizedBox(height: 2), // 图标和文字之间的间距
                                      Text(
                                        "分析中...",
                                        style: TextStyle(
                                          color: Colors.black, // 文字颜色为黑色，对比黄色背景
                                          fontSize: 10, // 较小的字体大小以适应圆形按钮
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  )
                                : Icon(
                                    // 非分析中状态，只显示图标
                                    Icons.insights,
                                    size: _aiOn && _isLiveAnalysisOn
                                        ? 28
                                        : 24, // 实时分析开启时图标大一点
                                    color: _aiOn
                                        ? (_isLiveAnalysisOn
                                            ? Colors.black // 实时分析开启，黑色图标以对比黄色背景
                                            : Colors.white60) // 实时分析关闭，浅灰图标
                                        : Colors.white38, // AI总开关关闭，更浅的灰色图标
                                  ),
                      ),
                    )
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  // --- Layer 6: 实时教练面板 ---

  /// 主构建方法，负责布局和动画，并组装各个UI部分。
  Widget _buildLiveCoachPanel() {
    final bool isVisible = _liveSuggestionData != null && _aiOn;

    // ✨ 1. 将标题的计算逻辑提取到一个独立的函数中
    final String title = _getCoachPanelTitle();
    final List<dynamic>? suggestions = _liveSuggestionData?['suggestions'];

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      top: isVisible ? 20.0 + MediaQuery.of(context).padding.top : -200,
      left: 16,
      right: 16,
      child: GestureDetector(
        // ✨ 2. 增加手势检测，让用户可以关闭它
        onVerticalDragEnd: (details) {
          if (details.primaryVelocity != null &&
              details.primaryVelocity! < -10) {
            setState(() {
              _aiOn = false;
              _liveAnalysisTimer?.cancel();
              _liveSuggestionData = null;
            });
          }
        },
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 3.0, sigmaY: 3.0), // 建议模糊度为3，效果更佳
            child: Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  // ✨ 3. 调用独立的构建方法来创建UI模块
                  _buildPanelHeader(title),
                  const Divider(height: 12, color: Colors.white24),
                  if (suggestions != null && suggestions.isNotEmpty)
                    _buildSuggestionsList(suggestions)
                  else
                    _buildEmptySuggestion(),
                  _buildDismissHint(), // ✨ 4. 增加一个可关闭的提示
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  /// ✨ NEW: 逻辑函数 - 专门负责计算面板标题
  // String _getCoachPanelTitle() {
  //   final Map<String, dynamic>? analysis = _liveSuggestionData?['analysis'];
  //   if (analysis == null) {
  //     return '实时建议';
  //   }

  //   final bool isLevel = analysis['is_level'] ?? true;
  //   final String brightness = analysis['brightness'] ?? 'N/A';
  //   final double tiltAngle = analysis['tilt_angle'] ?? 0.0;

  //   if (!isLevel && tiltAngle.abs() > 1.0) {
  //     // 增加一个阈值，避免微小倾斜也提示
  //     return '画面倾斜！ (${tiltAngle.toStringAsFixed(1)}°)';
  //   } else {
  //     return '光线：$brightness';
  //   }
  // }
  // ✨ MODIFIED: 移除光线逻辑后的版本
  String _getCoachPanelTitle() {
    final Map<String, dynamic>? analysis = _liveSuggestionData?['analysis'];
    if (analysis == null) {
      return '实时建议'; // 默认标题
    }

    final bool isLevel = analysis['is_level'] ?? true;
    final double tiltAngle = analysis['tilt_angle'] ?? 0.0;

    // 只在画面倾斜时显示警告
    if (!isLevel && tiltAngle.abs() > 1.0) {
      return '画面倾斜！ (${tiltAngle.toStringAsFixed(1)}°)';
    }

    // 其他所有情况，都返回默认标题
    return '实时建议';
  }

  /// ✨ NEW: UI构建函数 - 专门负责构建面板的头部（标题）
  Widget _buildPanelHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontWeight: FontWeight.bold,
        fontSize: 14,
        color: Colors.white,
      ),
    );
  }

  /// ✨ NEW: UI构建函数 - 专门负责构建建议列表
  Widget _buildSuggestionsList(List<dynamic> suggestions) {
    return Column(
      children: suggestions.map((suggestion) {
        final String action = suggestion['action'] ?? '无建议';
        return Padding(
          padding: const EdgeInsets.only(bottom: 6.0),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Padding(
                padding: EdgeInsets.only(top: 4.0, right: 8.0),
                child: Icon(Icons.circle, size: 6, color: Colors.white70),
              ),
              Expanded(
                child: Text(
                  action,
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ),
            ],
          ),
        );
      }).toList(),
    );
  }

  /// ✨ NEW: UI构建函数 - 专门负责构建空状态的提示
  Widget _buildEmptySuggestion() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 4.0), // 增加一点垂直间距
      child: Text(
        'AI正在思考中，或暂无建议。',
        style: TextStyle(
          color: Colors.white70,
          fontSize: 13,
          fontWeight: FontWeight.w500,
        ),
      ),
    );
  }

  /// ✨ NEW: UI构建函数 - 专门负责构建关闭提示
  Widget _buildDismissHint() {
    return const Padding(
      padding: EdgeInsets.only(top: 12.0),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.keyboard_arrow_up, color: Colors.white54, size: 20),
          SizedBox(width: 4),
          Text(
            "上滑关闭",
            style: TextStyle(color: Colors.white54, fontSize: 12),
          ),
        ],
      ),
    );
  }

  // --- Layer 7: 加载指示器 (在顶部) ---
  Widget _buildLoadingIndicator() {
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      top: _isAnalysing ? 20.0 + MediaQuery.of(context).padding.top : -100,
      left: 16,
      right: 16,
      // 使用 Align 是为了让内容居中，如果内容宽度不确定，这很有用
      child: Align(
        alignment: Alignment.center,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(24),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 1.0, sigmaY: 1.0),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
              decoration: BoxDecoration(
                color: Colors.white.withOpacity(0.15),
                borderRadius: BorderRadius.circular(24),
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                mainAxisSize: MainAxisSize.min, // 让Row的宽度自适应内容
                children: [
                  const SizedBox(
                    height: 16,
                    width: 16,
                    child: CircularProgressIndicator(
                      color: Colors.white70,
                      strokeWidth: 2,
                    ),
                  ),
                  const SizedBox(width: 16),
                  AnimatedSwitcher(
                    duration: const Duration(milliseconds: 300),
                    child: Text(
                      _loadingMessages[_loadingMessageIndex],
                      key: ValueKey<int>(_loadingMessageIndex),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
  // ===================================
  // ====== 7. 辅助方法 (Utility Methods) ======
  // ===================================

  /// 根据光线等级返回对应的颜色
  Color _getBrightnessColor(String level) {
    switch (level) {
      case '昏暗':
        return Colors.orange;
      case '明亮':
        return Colors.yellowAccent;
      case '适中':
        return Colors.greenAccent;
      default:
        return Colors.white70;
    }
  }
}

/// ====== 构图模式绘制器 ======
class CompositionLinesPainter extends CustomPainter {
  final CompositionMode compositionMode;

  // 父组件 LayoutBuilder 已经保证了此 Painter 的画布尺寸是正确的，
  // 无需再手动传入比例进行计算。
  CompositionLinesPainter({required this.compositionMode});

  @override
  void paint(Canvas canvas, Size size) {
    if (compositionMode == CompositionMode.none) {
      return; // 不绘制任何线
    }

    final Paint paint = Paint()
      ..color = Colors.white.withOpacity(0.6) // 构图线颜色
      ..strokeWidth = 1.0 // 线条可以细一些，减少对画面的干扰
      ..style = PaintingStyle.stroke;

    // 直接使用 CustomPaint 提供的精确尺寸 (size) 来定义绘制区域。
    final Rect drawRect = Offset.zero & size;

    switch (compositionMode) {
      case CompositionMode.thirds:
        _drawRuleOfThirds(canvas, paint, drawRect);
        break;
      case CompositionMode.diagonal:
        _drawDiagonalComposition(canvas, paint, drawRect);
        break;
      case CompositionMode.center:
        _drawCenterComposition(canvas, paint, drawRect);
        break;
      case CompositionMode.none:
        break;
    }
  }

  /// 绘制三分法辅助线
  void _drawRuleOfThirds(Canvas canvas, Paint paint, Rect rect) {
    final double width = rect.width;
    final double height = rect.height;

    // 垂直线
    canvas.drawLine(
      Offset(rect.left + width / 3, rect.top),
      Offset(rect.left + width / 3, rect.bottom),
      paint,
    );
    canvas.drawLine(
      Offset(rect.left + 2 * width / 3, rect.top),
      Offset(rect.left + 2 * width / 3, rect.bottom),
      paint,
    );

    // 水平线
    canvas.drawLine(
      Offset(rect.left, rect.top + height / 3),
      Offset(rect.right, rect.top + height / 3),
      paint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.top + 2 * height / 3),
      Offset(rect.right, rect.top + 2 * height / 3),
      paint,
    );
  }

  /// 绘制对角线构图辅助线
  void _drawDiagonalComposition(Canvas canvas, Paint paint, Rect rect) {
    canvas.drawLine(rect.topLeft, rect.bottomRight, paint);
    canvas.drawLine(rect.topRight, rect.bottomLeft, paint);
  }

  /// 绘制中心构图辅助线
  void _drawCenterComposition(Canvas canvas, Paint paint, Rect rect) {
    // 中心点
    canvas.drawCircle(rect.center, 5, paint);
    // 中心十字线
    canvas.drawLine(
      Offset(rect.center.dx, rect.top),
      Offset(rect.center.dx, rect.bottom),
      paint,
    );
    canvas.drawLine(
      Offset(rect.left, rect.center.dy),
      Offset(rect.right, rect.center.dy),
      paint,
    );
  }

  @override
  bool shouldRepaint(covariant CompositionLinesPainter oldDelegate) {
    // 现在，只有当构图模式改变时，才需要重绘。
    return oldDelegate.compositionMode != compositionMode;
  }
}
