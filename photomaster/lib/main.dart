// --------------  lib/main.dart  --------------
// PhotoMaster - 2025/07/26
// Created by Ai Ziqing / asandstar
// https://github.com/asandstar
// --------------------------------------------
import 'dart:ui';
import 'dart:io'; 
import 'dart:async';
import 'dart:convert';
import 'package:async/async.dart';
import 'package:flutter/material.dart';
import 'package:camera/camera.dart';
import 'package:flutter/services.dart';
import 'package:http/http.dart' as http;
import 'package:image/image.dart' as img;

const String kSfApiKey = 'sk-vgvnynkgjfxcacxxaxgpdykdccshljqjwqcschjrmyjvmjhh';

/// SiliconFlow 接口地址
final Uri kSfEndpoint =
    Uri.parse('https://api.siliconflow.cn/v1/chat/completions');

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
        title: 'PhotoMaster',
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

enum CompositionMode {
  none, // 无构图辅助线
  thirds, // 三分法构图
  diagonal, // 对角线构图
  center, // 中心构图
  // spiral, // 黄金螺旋
  // leadingLines, // 引导线
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
  bool _isLiveAnalysisOn = false;

  AnalysisResult? _result;
  bool _isAnalysing = false;
  Uint8List? _lastCapturedImageBytes;

  Timer? _liveAnalysisTimer;
  Map<String, dynamic>? _liveSuggestionData;
  bool _isAnalyzingLiveFrame = false;
  CancelableOperation? _currentAnalysisOperation;

  Timer? _loadingTimer;
  Timer? _liveResultDisplayTimer;
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
  String _currentBrightnessLevel = 'N/A';
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
    _currentAnalysisOperation?.cancel();
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
    final RenderBox? renderBox =
        _compositionButtonsKey.currentContext?.findRenderObject() as RenderBox?;
    if (renderBox != null) {
      final buttonRowHeight = renderBox.size.height;
      final buttonRowYPosition = renderBox.localToGlobal(Offset.zero).dy;
      final screenHeight = MediaQuery.of(context).size.height;
      final bottomControlsHeight = screenHeight - buttonRowYPosition;
      setState(() {
        _analysisCardBottomOffset = bottomControlsHeight + 16.0;
      });
    }
  }

  // ===================================
  // ====== 3. 相机控制逻辑 (Camera Control Logic) ======
  // ===================================

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
      debugPrint('相机初始化失败: $e');
      if (mounted) {
        setState(() => _result = AnalysisResult(
            category: "错误",
            praise: "相机启动失败",
            suggestion: "请检查相机权限或重启App",
            score: 0,
            isError: true));
      }
    }
  }

  Future<void> _handleFocusTap(TapUpDetails details) async {
    final cameraController = _cam;
    if (cameraController == null || !cameraController.value.isInitialized)
      return;

    final previewBox = context.findRenderObject() as RenderBox;
    final tapPositionInBox = previewBox.globalToLocal(details.globalPosition);

    if (tapPositionInBox.dx < 0 ||
        tapPositionInBox.dx > previewBox.size.width ||
        tapPositionInBox.dy < 0 ||
        tapPositionInBox.dy > previewBox.size.height) return;

    final double x = tapPositionInBox.dx / previewBox.size.width;
    final double y = tapPositionInBox.dy / previewBox.size.height;

    setState(() {
      _focusPoint = tapPositionInBox;
      _showFocusCircle = true;
    });

    try {
      await cameraController.setFocusMode(FocusMode.locked);
      await cameraController.setExposureMode(ExposureMode.locked);
      await cameraController.setFocusPoint(Offset(x, y));
      await cameraController.setExposurePoint(Offset(x, y));
      await cameraController.setExposureMode(ExposureMode.auto);
      await cameraController.setFocusMode(FocusMode.auto);
    } on CameraException catch (e) {
      debugPrint('设置对焦/测光失败: $e');
    }
    Future.delayed(const Duration(seconds: 2), () {
      if (mounted) setState(() => _showFocusCircle = false);
    });
  }

  void _handleScaleUpdate(ScaleUpdateDetails details) {
    final cameraController = _cam;
    if (cameraController == null || !cameraController.value.isInitialized)
      return;

    final newZoom =
        (_baseZoomLevel * details.scale).clamp(_minZoomLevel, _maxZoomLevel);

    if (newZoom != _currentZoomLevel) {
      cameraController.setZoomLevel(newZoom);
    }
    _zoomIndicatorTimer?.cancel();
    setState(() {
      _currentZoomLevel = newZoom;
      _showZoomIndicator = true;
    });

    _zoomIndicatorTimer = Timer(const Duration(milliseconds: 1500), () {
      if (mounted) {
        setState(() => _showZoomIndicator = false);
      }
    });
  }

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
      if (_aiOn && kSfApiKey.isNotEmpty) {
        if (mounted) setState(() => _result = null);
        await _analyse(_lastCapturedImageBytes!);
      } else if (_aiOn && kSfApiKey.isEmpty) {
        if (mounted) {
          setState(() => _result = AnalysisResult(
              category: "提示",
              praise: "API Key未设置",
              suggestion: "请在代码中填写您的kSfApiKey",
              score: 0,
              isError: true));
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

  void _startLiveAnalysisTimer() {
    _liveAnalysisTimer?.cancel();
    if (_aiOn && _isLiveAnalysisOn) {
      _liveAnalysisTimer = Timer.periodic(const Duration(seconds: 2), (timer) {
        if (!_isAnalyzingLiveFrame) {
          _captureAndAnalyzeFrame();
        }
      });
      debugPrint("实时分析定时器已启动。");
      _liveResultDisplayTimer?.cancel();
    } else {
      debugPrint("实时分析定时器已停止。");
      if (mounted) {
        setState(() {
          _liveSuggestionData = null;
          _currentBrightnessLevel = 'N/A';
          _liveResultDisplayTimer?.cancel();
          debugPrint('实时分析结果显示计时器已取消。');
        });
      }
    }
  }

  Future<void> _captureAndAnalyzeFrame() async {
    if (_cam == null || !_cam!.value.isInitialized) return;

    if (!_aiOn) {
      debugPrint("AI模式已关闭，不进行实时分析。");
      return;
    }

    if (_currentAnalysisOperation != null &&
        !_currentAnalysisOperation!.isCompleted) {
      debugPrint("存在未完成的分析请求，先取消它。");
      _currentAnalysisOperation!.cancel();
    }

    setState(() {
      _isAnalyzingLiveFrame = true;
      _liveSuggestionData = null;
      _currentBrightnessLevel = '分析中...';
    });

    try {
      await _cam!.setFlashMode(FlashMode.off);
      final pic = await _cam!.takePicture();
      final imageBytes = await pic.readAsBytes();
      final compressedBytes = await _compressImage(imageBytes);

      debugPrint('图片压缩完成，大小: ${compressedBytes.length} bytes');
      final uri = Uri.parse('http://192.168.50.133:5002/api/analyze');
      //final uri = Uri.parse('http://30.201.222.120:5002/api/analyze');
      debugPrint('准备发送请求到: $uri');

      var request = http.MultipartRequest('POST', uri);
      var multipartFile = http.MultipartFile.fromBytes(
        'image',
        compressedBytes,
        filename: 'upload.jpg',
      );
      request.files.add(multipartFile);

      debugPrint('请求已发出，等待响应...');
      final streamedResponseFuture =
          request.send().timeout(const Duration(seconds: 30));
      _currentAnalysisOperation =
          CancelableOperation.fromFuture(streamedResponseFuture);

      var streamedResponse = await _currentAnalysisOperation!.value;
      debugPrint('收到响应状态码: ${streamedResponse.statusCode}');
      var response = await http.Response.fromStream(streamedResponse);

      if (response.statusCode == 200) {
        debugPrint('HTTP 200 成功响应');
        final rawBody = utf8.decode(response.bodyBytes);
        debugPrint('原始响应体: $rawBody');

        final outerData = jsonDecode(rawBody) as Map<String, dynamic>;
        if (outerData['status'] == 'success' && outerData.containsKey('data')) {
          final innerJsonString = outerData['data'] as String;
          final innerData = jsonDecode(innerJsonString) as Map<String, dynamic>;
          if (mounted) {
            setState(() {
              _liveSuggestionData = innerData;
              final analysis = innerData['analysis'];
              if (analysis != null) {
                _currentBrightnessLevel =
                    analysis['brightness'] as String? ?? 'N/A';
              }
            });
          }
        } else {
          debugPrint(
              'API返回成功状态码200，但业务逻辑失败。状态: ${outerData['status'] ?? '未知状态'}, 消息: ${outerData['message'] ?? '无'}');
          if (mounted) {
            setState(() {
              _liveSuggestionData = {
                "title": "API返回异常",
                "steps": [
                  "状态: ${outerData['status'] ?? '未知状态'}",
                  "详情: ${outerData['message'] ?? '无'}"
                ]
              };
              _currentBrightnessLevel = '异常';
            });
          }
        }
      } else {
        debugPrint(
            'HTTP 响应非 200: ${response.statusCode}, Reason: ${response.reasonPhrase}');
        if (mounted) {
          setState(() => _liveSuggestionData = {
                "title": "分析失败",
                "steps": [
                  "服务器错误 (Code: ${response.statusCode})",
                  "详情: ${response.reasonPhrase ?? '无'}"
                ]
              });
          _currentBrightnessLevel = '失败';
        }
      }
    } on TimeoutException catch (e) {
      debugPrint('请求超时异常: $e');
      if (mounted) {
        setState(() => _liveSuggestionData = {
              "title": "请求超时",
              "steps": [
                "服务器未在限定时间内响应。",
                "请检查网络或服务器负载。",
                "错误: ${e.toString().split(':')[0]}"
              ]
            });
        _currentBrightnessLevel = '超时';
      }
    } on SocketException catch (e) {
      debugPrint('网络连接异常（SocketException）: $e');
      if (mounted) {
        setState(() => _liveSuggestionData = {
              "title": "网络连接失败",
              "steps": ["无法连接到服务器，请检查网络。", "确保手机与服务器在同一网络。", "错误: ${e.message}"]
            });
        _currentBrightnessLevel = '无网络';
      }
    } catch (e) {
      debugPrint('实时分析发生未知异常: $e');
      if (mounted) {
        setState(() => _liveSuggestionData = {
              "title": "分析发生错误",
              "steps": ["发生未知错误，请重试。", "错误详情: ${e.toString().split(',')[0]}"]
            });
        _currentBrightnessLevel = '错误';
      }
    } finally {
      _currentAnalysisOperation = null;
      Future.delayed(const Duration(seconds: 4), () {
        if (mounted) {
          setState(() {
            _isAnalyzingLiveFrame = false;
          });
        }
      });
    }
  }

  Future<void> _analyse(Uint8List jpg) async {
    final stopwatch = Stopwatch()..start();

    if (mounted) {
      setState(() {
        _isAnalysing = true;
        _loadingMessageIndex = 0;
      });
      _loadingTimer = Timer.periodic(const Duration(seconds: 3), (timer) {
        if (!_isAnalysing) {
          timer.cancel();
          return;
        }
        setState(() {
          _loadingMessageIndex =
              (_loadingMessageIndex + 1) % _loadingMessages.length;
        });
      });
    }

    final payload = {
      'model': 'MiniMaxAI/MiniMax-M1-80k',
      'temperature': 0.5,
      'max_tokens': 150,
      'messages': [
        {
          'role': 'system',
          'content': '''
你是一位充满激情、善于鼓励的摄影导师。你的任务是分析一张用户拍摄的照片，并以JSON格式返回你的分析报告。

请遵循以下思考步骤：
1.  **识别类别**: 首先，判断这张照片的主要类别是什么？从 ["风景", "人像", "美食", "静物", "宠物", "建筑", "夜景", "街拍"] 中选择一个最贴切的。
2.  **核心优势**: 找出照片最值得肯定的1-2个优点。
3.  **关键提升点**: 找出对画面改善最明显的1个问题，并根据识别出的类别，提供针对性的建议。
4.  **行动指令**: 基于这个关键提升点，给出一句具体的、小白也能立刻执行的行动指令（20字以内）。

现在，请将你的分析报告严格按照以下JSON格式输出。
你的整个回复必须是一个能够直接被程序解析的、纯净的JSON对象。
不要在JSON前后添加任何包括“好的”、“这是您要的分析”在内的解释性文字、注释或Markdown标记 (例如```json)。

{
  "category": "识别出的类别",
  "praise": "这里是核心优势的总结",
  "suggestion": "这里是具体的行动指令"
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
    AnalysisResult? finalResult;
    try {
      debugPrint("--- AI分析计时开始 ---");

      final res = await http
          .post(kSfEndpoint,
              headers: {
                'Authorization': 'Bearer $kSfApiKey',
                'Content-Type': 'application/json',
              },
              body: jsonEncode(payload))
          .timeout(const Duration(seconds: 20));

      debugPrint("--- 网络+AI计算耗时: ${stopwatch.elapsedMilliseconds}ms ---");

      if (res.statusCode == 200) {
        final rawResponseText = utf8.decode(res.bodyBytes);
        final rawContent =
            jsonDecode(rawResponseText)['choices'][0]['message']['content'];
        debugPrint("📝 原始内容：$rawContent");

        final pureJson = _extractPureJson(rawContent);
        debugPrint("✨ 纯净JSON：$pureJson");

        try {
          final resultMap = jsonDecode(pureJson) as Map<String, dynamic>;
          finalResult = AnalysisResult.fromJson(resultMap);
        } catch (e) {
          debugPrint("❌ JSON解析失败: $e");
          finalResult = AnalysisResult(
            category: "错误",
            praise: "解析失败",
            suggestion: "AI返回内容非标准JSON",
            score: 0,
            isError: true,
          );
        }
      } else {
        finalResult = AnalysisResult(
          category: "错误",
          praise: "请求失败",
          suggestion: "API错误，状态码: ${res.statusCode}",
          score: 0,
          isError: true,
        );
      }
    } catch (e) {
      debugPrint("❌ 网络异常: $e");
      finalResult = AnalysisResult(
        category: "错误",
        praise: "网络异常",
        suggestion: "无法连接到分析服务器",
        score: 0,
        isError: true,
      );
    } finally {
      stopwatch.stop();
      debugPrint("--- 总耗时 (包括解析): ${stopwatch.elapsedMilliseconds}ms ---");
      _loadingTimer?.cancel();
      if (mounted) {
        setState(() {
          _result = finalResult;
          _isAnalysing = false;
        });
      }
    }
  }

  String _extractPureJson(String rawText) {
    final cleaned = rawText.trim().replaceAll(RegExp(r'```json|```'), '');
    final match = RegExp(r'{[\s\S]*}').firstMatch(cleaned);
    return match?.group(0) ?? '';
  }

  void _retryAnalysis() {
    if (_lastCapturedImageBytes != null) {
      setState(() => _result = null);
      _analyse(_lastCapturedImageBytes!);
    }
  }

  // ===================================
  // ====== 5. 图像处理辅助方法 (Image Processing Helpers) ======
  // ===================================

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

  // --- Layer 4: 分析卡片 (重构后，使用Stack布局提示) ---
  Widget _buildAnalysisCard(BuildContext context) {
    final bool isCardVisible = _result != null;
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      bottom: isCardVisible ? _analysisCardBottomOffset : -300,
      left: 16,
      right: 16,
      child: GestureDetector(
        onVerticalDragEnd: (details) {
          if (details.primaryVelocity != null &&
              details.primaryVelocity! > 10) {
            setState(() => _result = null);
          }
        },
        onHorizontalDragEnd: (details) {
          if (details.primaryVelocity != null &&
              details.primaryVelocity! < -100) {
            setState(() => _result = null);
          }
        },
        // 1. 使用 Stack 来堆叠卡片内容和提示
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // 主要的卡片内容
            _buildCardContent(),
            // 左滑关闭的提示
            // _buildLeftDismissHint(),
            // 下滑关闭的提示
            _buildBottomDismissHint(),
          ],
        ),
      ),
    );
  }

  Widget _buildCardContent() {
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
              Text(
                _result?.category ?? '分析结果',
                style: TextStyle(
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                  color: _result?.isError == true
                      ? Colors.red.shade400
                      : Colors.white,
                ),
              ),
              const Divider(height: 12, color: Colors.white24),
              Text("👍 优点: ${_result?.praise ?? ''}",
                  style: const TextStyle(fontSize: 14, color: Colors.white)),
              const SizedBox(height: 6),
              Text("👉 建议: ${_result?.suggestion ?? ''}",
                  style: const TextStyle(fontSize: 14, color: Colors.white)),
              if (_result?.isError == true) ...[
                const SizedBox(height: 12),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton.icon(
                    onPressed: _retryAnalysis,
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
              const SizedBox(height: 30),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildLeftDismissHint() {
    return Positioned(
      left: -28, // 将提示稍微移出卡片边界，视觉上更突出
      top: 0,
      bottom: 0,
      child: Center(
        child: IgnorePointer(
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

  Widget _buildBottomDismissHint() {
    return Positioned(
      bottom: -10,
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
              ToggleButtons(
                isSelected: [_aiOn, !_aiOn],
                onPressed: (index) {
                  setState(() {
                    _aiOn = (index == 0);
                    if (_aiOn) {
                      if (_isLiveAnalysisOn) {
                        _startLiveAnalysisTimer();
                      }
                    } else {
                      _liveAnalysisTimer?.cancel();
                      _liveSuggestionData = null;
                      _isAnalyzingLiveFrame = false;
                      _loadingTimer?.cancel();
                      _loadingMessageIndex = 0;
                      _isLiveAnalysisOn = false;
                      _currentAnalysisOperation?.cancel();
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
                    GestureDetector(
                      onTap: _aiOn
                          ? () {
                              setState(() {
                                _isLiveAnalysisOn = !_isLiveAnalysisOn;

                                if (_isLiveAnalysisOn) {
                                  _startLiveAnalysisTimer();
                                  debugPrint('实时分析已开启');
                                } else {
                                  _liveAnalysisTimer?.cancel();
                                  _currentAnalysisOperation?.cancel();
                                  _liveSuggestionData = null;
                                  _isAnalyzingLiveFrame = false;
                                  _loadingTimer?.cancel();
                                  _loadingMessageIndex = 0;
                                  debugPrint('实时分析已关闭');
                                }
                              });
                            }
                          : null,
                      child: Container(
                        width: 60,
                        height: 60,
                        decoration: BoxDecoration(
                          color: _aiOn
                              ? (_isLiveAnalysisOn
                                  ? (_isAnalyzingLiveFrame
                                      ? Colors.yellow.withOpacity(0.8)
                                      : Colors.yellow)
                                  : Colors.grey.withOpacity(0.5))
                              : Colors.grey.withOpacity(0.3),
                          shape: BoxShape.circle,
                          border: Border.all(
                            color: _aiOn
                                ? (_isLiveAnalysisOn
                                    ? (_isAnalyzingLiveFrame
                                        ? Colors.white
                                        : Colors.white70)
                                    : Colors.transparent)
                                : Colors.transparent,
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
                        child:
                            _aiOn && _isLiveAnalysisOn && _isAnalyzingLiveFrame
                                ? Column(
                                    mainAxisAlignment: MainAxisAlignment.center,
                                    children: const [
                                      Icon(
                                        Icons.insights,
                                        size: 24,
                                        color: Colors.black,
                                      ),
                                      SizedBox(height: 2),
                                      Text(
                                        "分析中...",
                                        style: TextStyle(
                                          color: Colors.black,
                                          fontSize: 10,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ],
                                  )
                                : Icon(
                                    Icons.insights,
                                    size: _aiOn && _isLiveAnalysisOn ? 28 : 24,
                                    color: _aiOn
                                        ? (_isLiveAnalysisOn
                                            ? Colors.black
                                            : Colors.white60)
                                        : Colors.white38,
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

  Widget _buildLiveCoachPanel() {
    final bool isVisible = _liveSuggestionData != null && _aiOn;

    // 1. 将标题的计算逻辑提取到一个独立的函数中
    final String title = _getCoachPanelTitle();
    final List<dynamic>? suggestions = _liveSuggestionData?['suggestions'];

    return AnimatedPositioned(
      duration: const Duration(milliseconds: 500),
      curve: Curves.easeOutCubic,
      top: isVisible ? 20.0 + MediaQuery.of(context).padding.top : -200,
      left: 16,
      right: 16,
      child: GestureDetector(
        // 2. 增加手势检测，让用户可以关闭它
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
                  // 3. 调用独立的构建方法来创建UI模块
                  _buildPanelHeader(title),
                  const Divider(height: 12, color: Colors.white24),
                  if (suggestions != null && suggestions.isNotEmpty)
                    _buildSuggestionsList(suggestions)
                  else
                    _buildEmptySuggestion(),
                  _buildDismissHint(), //4. 增加一个可关闭的提示
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _getCoachPanelTitle() {
    final Map<String, dynamic>? analysis = _liveSuggestionData?['analysis'];
    if (analysis == null) {
      return '实时建议';
    }
    final bool isLevel = analysis['is_level'] ?? true;
    final double tiltAngle = analysis['tilt_angle'] ?? 0.0;
    if (!isLevel && tiltAngle.abs() > 1.0) {
      return '画面倾斜！ (${tiltAngle.toStringAsFixed(1)}°)';
    }
    return '实时建议';
  }

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

  Widget _buildEmptySuggestion() {
    return const Padding(
      padding: EdgeInsets.symmetric(vertical: 4.0),
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
                mainAxisSize: MainAxisSize.min,
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

  CompositionLinesPainter({required this.compositionMode});

  @override
  void paint(Canvas canvas, Size size) {
    if (compositionMode == CompositionMode.none) {
      return;
    }

    final Paint paint = Paint()
      ..color = Colors.white.withOpacity(0.6)
      ..strokeWidth = 1.0
      ..style = PaintingStyle.stroke;
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

  void _drawRuleOfThirds(Canvas canvas, Paint paint, Rect rect) {
    final double width = rect.width;
    final double height = rect.height;

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

  void _drawDiagonalComposition(Canvas canvas, Paint paint, Rect rect) {
    canvas.drawLine(rect.topLeft, rect.bottomRight, paint);
    canvas.drawLine(rect.topRight, rect.bottomLeft, paint);
  }

  void _drawCenterComposition(Canvas canvas, Paint paint, Rect rect) {
    canvas.drawCircle(rect.center, 5, paint);
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
    return oldDelegate.compositionMode != compositionMode;
  }
}
