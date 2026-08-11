import React, { useEffect, useRef } from 'react';
import QRCode from 'qrcode';

interface QrCodeCanvasProps {
  value: string;
  size?: number;
  className?: string;
}

export const QrCodeCanvas: React.FC<QrCodeCanvasProps> = ({ value, size = 160, className }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current || !value) return;
    QRCode.toCanvas(canvasRef.current, value, {
      width: size,
      margin: 1,
      color: { dark: 'var(--text-primary)', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch(() => {});
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} />;
};
