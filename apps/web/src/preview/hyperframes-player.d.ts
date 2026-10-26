import type { DetailedHTMLProps, HTMLAttributes } from 'react';

// The <hyperframes-player> custom element (@hyperframes/player), with the attributes the preview uses.
declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'hyperframes-player': DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
        srcdoc?: string;
        /** Where the player loads the runtime from when it has to (default: a CDN, which the CSP blocks). */
        'runtime-src'?: string;
        width?: number;
        height?: number;
        controls?: boolean;
        loop?: boolean;
        'assets-loading-ui'?: 'player' | 'none';
      };
    }
  }
}
