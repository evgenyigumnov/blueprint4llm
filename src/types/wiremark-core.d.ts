declare module '@wiremark/core' {
  export interface WiremarkDiagnostic {
    severity: 'warning' | 'error';
    message: string;
    loc?: {
      line: number;
      col?: number;
    };
  }

  export interface WiremarkRenderResult {
    svg: string;
    diagnostics: WiremarkDiagnostic[];
  }

  export function render(source: string): WiremarkRenderResult;
}
