import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

void main() {
  runApp(const RbmCounterApp());
}

class RbmCounterApp extends StatelessWidget {
  const RbmCounterApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Counter',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        scaffoldBackgroundColor: Colors.black,
        useMaterial3: true,
      ),
      home: const CounterPage(),
    );
  }
}

class CounterPage extends StatefulWidget {
  const CounterPage({super.key});

  @override
  State<CounterPage> createState() => _CounterPageState();
}

class _CounterPageState extends State<CounterPage>
    with SingleTickerProviderStateMixin {
  static const _text = Color(0xFFF4F7FF);
  static const _muted = Color(0xFF6E7AA3);
  static const _accent = Color(0xFFFFB84D);

  int _counter = 0;
  String? _lastAction;
  final FocusNode _focusNode = FocusNode();
  late final AnimationController _pulse;

  @override
  void initState() {
    super.initState();
    _pulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 220),
    );
  }

  @override
  void dispose() {
    _focusNode.dispose();
    _pulse.dispose();
    super.dispose();
  }

  void _flash(String label) {
    setState(() => _lastAction = label);
    _pulse.forward(from: 0);
  }

  void _increment() {
    setState(() => _counter++);
    _flash('+1');
  }

  void _decrement() {
    if (_counter == 0) return;
    setState(() => _counter--);
    _flash('-1');
  }

  void _reset() {
    if (_counter == 0) return;
    setState(() => _counter = 0);
    _flash('RESET');
  }

  KeyEventResult _onKey(FocusNode node, KeyEvent event) {
    if (event is! KeyDownEvent && event is! KeyRepeatEvent) {
      return KeyEventResult.ignored;
    }
    final key = event.logicalKey;
    if (key == LogicalKeyboardKey.arrowUp) {
      _increment();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.arrowDown) {
      _decrement();
      return KeyEventResult.handled;
    }
    if (key == LogicalKeyboardKey.enter ||
        key == LogicalKeyboardKey.numpadEnter ||
        key == LogicalKeyboardKey.space) {
      _reset();
      return KeyEventResult.handled;
    }
    return KeyEventResult.ignored;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: Focus(
        focusNode: _focusNode,
        autofocus: true,
        onKeyEvent: _onKey,
        child: Center(
          child: SizedBox(
            width: 600,
            height: 600,
            child: Stack(
              children: [
                // Title
                Positioned(
                  top: 38,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Text(
                      'COUNTER',
                      style: TextStyle(
                        color: _muted,
                        fontSize: 18,
                        letterSpacing: 8,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                  ),
                ),
                // Big counter number
                Center(
                  child: AnimatedBuilder(
                    animation: _pulse,
                    builder: (context, child) {
                      final t = _pulse.value;
                      final scale = 1.0 + (1 - (t - 0.5).abs() * 2) * 0.04;
                      return Transform.scale(
                        scale: scale.clamp(1.0, 1.04),
                        child: child,
                      );
                    },
                    child: Text(
                      '$_counter',
                      style: const TextStyle(
                        color: _text,
                        fontSize: 240,
                        fontWeight: FontWeight.w600,
                        height: 1.0,
                        fontFeatures: [FontFeature.tabularFigures()],
                      ),
                    ),
                  ),
                ),
                // Last action chip
                Positioned(
                  top: 78,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: AnimatedOpacity(
                      duration: const Duration(milliseconds: 120),
                      opacity: _lastAction == null ? 0 : 1,
                      child: Text(
                        _lastAction ?? '',
                        style: const TextStyle(
                          color: _accent,
                          fontSize: 22,
                          letterSpacing: 3,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  ),
                ),
                // Footer hints
                Positioned(
                  left: 0,
                  right: 0,
                  bottom: 42,
                  child: Center(
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: const [
                        _Hint(glyph: '▲', label: '+1'),
                        SizedBox(width: 28),
                        _Hint(glyph: '▼', label: '-1'),
                        SizedBox(width: 28),
                        _Hint(glyph: '↵', label: 'RESET'),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _Hint extends StatelessWidget {
  const _Hint({required this.glyph, required this.label});

  final String glyph;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.center,
      children: [
        Text(
          glyph,
          style: const TextStyle(
            color: Color(0xFFF4F7FF),
            fontSize: 18,
            fontWeight: FontWeight.w600,
          ),
        ),
        const SizedBox(width: 8),
        Text(
          label,
          style: const TextStyle(
            color: Color(0xFF6E7AA3),
            fontSize: 14,
            letterSpacing: 2,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }
}
