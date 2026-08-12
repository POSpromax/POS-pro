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
      // Digambar ke canvas, bukan lewat CSS: library ini hanya menerima hex.
      // Memakai var(--text-primary) di sini membuat QR gagal digambar sama
      // sekali dengan "Invalid hex color", dan pelanggan tidak bisa memindai.
      color: { dark: '#1A1714', light: '#FFFFFF' },
      errorCorrectionLevel: 'M',
    }).catch((error) => {
      console.error('[QR meja] gagal digambar:', error);
    });
  }, [value, size]);

  return <canvas ref={canvasRef} className={className} />;
};
