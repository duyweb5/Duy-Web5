import { Component, ErrorInfo, ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = {
    hasError: false,
    errorMessage: '',
  };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error.message || 'Unexpected application error.',
    };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-[#F7F8FA] p-6">
          <div className="w-full max-w-lg rounded-xl border border-[#E3E7EE] bg-white p-8">
            <p className="text-xs font-semibold text-[#C8102E]">
              Meet Boston CMS
            </p>
            <h1 className="mt-2 font-display text-2xl font-extrabold text-[#0A2239]">
              Đã xảy ra lỗi kết nối dữ liệu
            </h1>
            <p className="mt-3 text-sm leading-relaxed text-[#526071]">
              Hệ thống vừa gặp lỗi khi đồng bộ hoặc xác thực quyền truy cập dữ liệu. Vui lòng tải lại trang hoặc đăng nhập lại bằng tài khoản quản trị.
            </p>
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#F7F8FA] p-3 font-mono text-xs text-[#526071]">
              {this.state.errorMessage}
            </pre>
            <div className="mt-6 flex items-center gap-3">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="inline-flex min-h-[40px] items-center rounded-lg bg-[#0A2239] px-4 py-2 text-sm font-semibold text-white hover:bg-[#133454]"
              >
                Tải lại trang
              </button>
              <button
                type="button"
                onClick={() => {
                  window.location.hash = '';
                  this.setState({ hasError: false, errorMessage: '' });
                }}
                className="inline-flex min-h-[40px] items-center rounded-lg border border-[#E3E7EE] px-4 py-2 text-sm font-semibold text-[#0F1B2B] hover:bg-[#F7F8FA]"
              >
                Về trang chủ
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
