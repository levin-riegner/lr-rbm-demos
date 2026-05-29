import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:flutter_display/main.dart';

void main() {
  testWidgets('Counter responds to D-pad keys', (WidgetTester tester) async {
    await tester.pumpWidget(const RbmCounterApp());
    await tester.pumpAndSettle();

    expect(find.text('0'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
    await tester.pump();
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowUp);
    await tester.pump();
    expect(find.text('2'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    expect(find.text('1'), findsOneWidget);

    await tester.sendKeyEvent(LogicalKeyboardKey.enter);
    await tester.pump();
    expect(find.text('0'), findsOneWidget);

    // Decrement at zero is a no-op.
    await tester.sendKeyEvent(LogicalKeyboardKey.arrowDown);
    await tester.pump();
    expect(find.text('0'), findsOneWidget);
  });
}
