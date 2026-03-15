from pathlib import Path


def test_login_screen_does_not_render_demo_credentials():
    login_screen = Path('frontend/app/(auth)/login.tsx').read_text()

    assert 'admin@store.com' not in login_screen
    assert 'admin123' not in login_screen
    assert 'Demo Credentials' not in login_screen
