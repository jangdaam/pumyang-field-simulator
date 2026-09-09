/// <reference types="vite/client" />
import type { ImgHTMLAttributes } from 'react';

// The shared page uses SVGs only. A native image keeps this build server-free
// and resolves public assets beneath GitHub Pages' repository path.
export default function Image({
  src,
  alt = '',
  unoptimized: _unoptimized,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  const resolved =
    typeof src === 'string' && src.startsWith('/') && !src.startsWith('//')
      ? `${import.meta.env.BASE_URL}${src.slice(1)}`
      : src;
  // This static SVG adapter intentionally has no Next.js image server.
  // oxlint-disable-next-line next/no-img-element
  return <img {...props} alt={alt} src={resolved} />;
}
