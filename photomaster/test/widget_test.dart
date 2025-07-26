// test/widget_test.dart

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:photomaster/main.dart'; // Make sure 'photomaster' matches your project name
import 'package:camera/camera.dart';

// Create a mock list of cameras for the test environment
final mockCameras = [
  const CameraDescription(
    name: '0',
    lensDirection: CameraLensDirection.back,
    sensorOrientation: 90,
  ),
];

void main() {
  testWidgets('App starts and shows a loading indicator',
      (WidgetTester tester) async {
    // Build the app using the mock camera
    await tester.pumpWidget(MyApp(camera: mockCameras.first));

    // Because the camera initialization is asynchronous,
    // we expect to see a loading circle initially.
    expect(find.byType(CircularProgressIndicator), findsOneWidget);
  });
}
