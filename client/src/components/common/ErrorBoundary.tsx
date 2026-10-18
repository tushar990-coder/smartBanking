import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 font-sans text-slate-800">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg border border-rose-200 p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
              ⚠️
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">
                काहीतरी तांत्रिक अडचण आली आहे
              </h2>
              <p className="text-xs text-slate-500 mt-1">
                घटक लोड करताना त्रुटी आली. कृपया पुन्हा प्रयत्न करा किंवा मुख्य डॅशबोर्डवर जा.
              </p>
            </div>
            {this.state.error && (
              <div className="text-left bg-slate-100 p-2.5 rounded text-[11px] font-mono text-rose-700 overflow-x-auto max-h-32 border border-slate-200">
                {this.state.error.toString()}
              </div>
            )}
            <div className="pt-2 flex gap-2">
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="flex-1 px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold transition-all cursor-pointer"
              >
                🔄 पेज रिफ्रेश करा
              </button>
              <button
                type="button"
                onClick={this.handleReset}
                className="flex-1 px-4 py-2 bg-primary hover:bg-[#004a75] text-white rounded-lg text-xs font-bold transition-all shadow-xs cursor-pointer"
              >
                🏠 मुख्य डॅशबोर्ड
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
