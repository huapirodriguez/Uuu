/**
 * WebUSB and USB Smartphone Connection Manager
 * Manages physical USB cable connection with mobile devices (Android / iOS).
 */

export interface ConnectedUsbDevice {
  id: string;
  productName: string;
  manufacturerName: string;
  vendorId: number;
  productId: number;
  vendorIdHex: string;
  productIdHex: string;
  serialNumber?: string;
  connectionType: 'usb-cable' | 'usb-adb' | 'usb-simulated';
  speedMbps: number;
  connectedAt: number;
  deviceClass?: string;
}

/// Common Smartphone USB Vendor IDs
export const SMARTPHONE_USB_VENDORS: Record<number, string> = {
  0x22b8: 'Motorola Mobility LLC',
  0x18d1: 'Google (Pixel / Android)',
  0x04e8: 'Samsung Electronics',
  0x05ac: 'Apple Inc. (iPhone / iPad)',
  0x2717: 'Xiaomi Inc.',
  0x12d1: 'Huawei Technologies',
  0x0fce: 'Sony Mobile',
  0x1004: 'LG Electronics',
  0x2a70: 'OnePlus Technology',
  0x22d9: 'OPPO Mobile',
  0x2d95: 'Vivo Mobile',
};

export function isWebUsbSupported(): boolean {
  return typeof navigator !== 'undefined' && 'usb' in navigator;
}

/**
 * Maps vendorId to recognizable smartphone manufacturer
 */
export function getVendorName(vendorId: number): string {
  return SMARTPHONE_USB_VENDORS[vendorId] || `Fabricante USB (0x${vendorId.toString(16).padStart(4, '0')})`;
}

/**
 * Format hexadecimal vendor/product ID
 */
export function formatHexId(val: number): string {
  return `0x${val.toString(16).toUpperCase().padStart(4, '0')}`;
}

export function isInsideIframe(): boolean {
  try {
    if (typeof window === 'undefined') return false;
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Request real USB Smartphone connection via WebUSB API
 */
export async function requestUsbSmartphone(): Promise<ConnectedUsbDevice> {
  if (!isWebUsbSupported()) {
    throw new Error('WebUSB API no está disponible en este navegador. Utiliza Google Chrome, Edge o un navegador compatible con WebUSB.');
  }

  // Filters for common smartphone vendors
  const filters = Object.keys(SMARTPHONE_USB_VENDORS).map((vid) => ({
    vendorId: Number(vid),
  }));

  try {
    // Request device permission from browser native prompt
    const usbDevice = await (navigator as any).usb.requestDevice({
      filters: filters.length > 0 ? filters : undefined,
    });

    if (!usbDevice) {
      throw new Error('No se seleccionó ningún dispositivo USB.');
    }

    const manufacturer = usbDevice.manufacturerName || getVendorName(usbDevice.vendorId);
    const product = usbDevice.productName || 'Smartphone USB';

    const connectedDevice: ConnectedUsbDevice = {
      id: `usb-${usbDevice.vendorId}-${usbDevice.productId}-${Date.now()}`,
      productName: product,
      manufacturerName: manufacturer,
      vendorId: usbDevice.vendorId,
      productId: usbDevice.productId,
      vendorIdHex: formatHexId(usbDevice.vendorId),
      productIdHex: formatHexId(usbDevice.productId),
      serialNumber: usbDevice.serialNumber || 'USB-HID-AUTO',
      connectionType: 'usb-cable',
      speedMbps: 480, // High-speed USB 2.0 / USB-C
      connectedAt: Date.now(),
      deviceClass: 'Dispositivo Android / MTP / ADB',
    };

    return connectedDevice;
  } catch (err: any) {
    if (err.name === 'NotFoundError') {
      throw new Error('Selección cancelada por el usuario.');
    }

    // Browser SecurityError: Permissions Policy iframe restriction
    const msg = String(err.message || '');
    if (
      err.name === 'SecurityError' ||
      msg.toLowerCase().includes('permissions policy') ||
      msg.toLowerCase().includes('disallowed') ||
      msg.toLowerCase().includes('feature "usb"')
    ) {
      const customErr = new Error(
        'PERMISSIONS_POLICY_IFRAME_BLOCKED'
      );
      (customErr as any).code = 'PERMISSIONS_POLICY_IFRAME_BLOCKED';
      throw customErr;
    }

    throw new Error(err.message || 'Error al conectar dispositivo USB.');
  }
}

/**
 * Check already paired USB devices
 */
export async function getPairedUsbDevices(): Promise<ConnectedUsbDevice[]> {
  if (!isWebUsbSupported()) return [];
  try {
    const devices = await (navigator as any).usb.getDevices();
    return devices.map((d: any) => ({
      id: `usb-${d.vendorId}-${d.productId}`,
      productName: d.productName || 'Dispositivo USB',
      manufacturerName: d.manufacturerName || getVendorName(d.vendorId),
      vendorId: d.vendorId,
      productId: d.productId,
      vendorIdHex: formatHexId(d.vendorId),
      productIdHex: formatHexId(d.productId),
      serialNumber: d.serialNumber,
      connectionType: 'usb-cable',
      speedMbps: 480,
      connectedAt: Date.now(),
    }));
  } catch {
    return [];
  }
}

export interface UsbPhoneModel {
  id: string;
  brand: 'Motorola' | 'Samsung' | 'Google' | 'Apple' | 'Xiaomi' | 'Otros';
  series?: 'Edge' | 'Razr' | 'Moto G' | 'ThinkPhone' | 'Moto E' | 'Galaxy' | 'Pixel' | 'iPhone' | 'Xiaomi';
  model: string;
  manufacturer: string;
  vendorId: number;
  productId: number;
  speedMbps: number;
  port: string;
  mode: string;
  features?: string[];
  popular?: boolean;
}

/**
 * Catálogo exhaustivo de todos los modelos de teléfonos Motorola
 * Incluye gamas Edge, Razr plegables, Moto G, ThinkPhone y Moto E
 */
export const MOTOROLA_PHONE_MODELS: UsbPhoneModel[] = [
  // --- Serie Motorola Edge (Gama Alta / Flagship) ---
  {
    id: 'moto-edge-50-ultra',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 50 Ultra',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e82,
    speedMbps: 480,
    port: 'USB Type-C 3.1 Gen 2 DisplayPort',
    mode: 'Smart Connect / Ready For + ADB',
    features: ['Snapdragon 8s Gen 3', 'Ready For PC Link', 'TurboPower 125W'],
    popular: true,
  },
  {
    id: 'moto-edge-50-pro',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 50 Pro',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 3.1 TurboPower',
    mode: 'MTP + Depuración USB (ADB)',
    features: ['Pantalla pOLED 144Hz', 'Carga 125W', 'Smart Connect'],
    popular: true,
  },
  {
    id: 'moto-edge-50-fusion',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 50 Fusion',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0 OTG',
    mode: 'MTP / Transferencia de Archivos',
    features: ['Cámara LYTIA 700C OIS', 'IP68', 'TurboPower 68W'],
    popular: true,
  },
  {
    id: 'moto-edge-50-neo',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 50 Neo',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP + Android Debug Bridge',
    features: ['MIL-STD-810H Grado Militar', 'Pantalla LTPO 120Hz'],
  },
  {
    id: 'moto-edge-40-pro',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 40 Pro',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e24,
    speedMbps: 480,
    port: 'USB-C 3.2 Gen 2 Video Out',
    mode: 'Motorola Ready For Desktop Hub',
    features: ['Snapdragon 8 Gen 2', 'Ready For Escitorio', '165Hz'],
  },
  {
    id: 'moto-edge-40-neo',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 40 Neo',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP Composite Device',
    features: ['Colores Pantone', 'IP68 Sumergible', 'pOLED 144Hz'],
    popular: true,
  },
  {
    id: 'moto-edge-40',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 40',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0 High Speed',
    mode: 'MTP / USB Tethering',
    features: ['Chasis ultradelgado 7.5mm', 'Cuero vegano'],
  },
  {
    id: 'moto-edge-30-ultra',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 30 Ultra',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e24,
    speedMbps: 480,
    port: 'USB Type-C 3.1 Gen 1',
    mode: 'Ready For / Smart Connect Direct',
    features: ['Sensor 200MP OIS', 'Carga 125W', 'Ready For'],
  },
  {
    id: 'moto-edge-30-fusion',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 30 Fusion',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 3.1',
    mode: 'Ready For Wireless & Cable',
    features: ['Snapdragon 888+', 'Pantalla curva 144Hz'],
  },
  {
    id: 'moto-edge-30-neo',
    brand: 'Motorola',
    series: 'Edge',
    model: 'Motorola Edge 30 Neo',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP Android',
    features: ['Compacto 6.28"', 'Colores Pantone Very Peri'],
  },

  // --- Serie Motorola Razr (Plegables / Foldables) ---
  {
    id: 'moto-razr-50-ultra',
    brand: 'Motorola',
    series: 'Razr',
    model: 'Motorola Razr 50 Ultra / Razr+ 2024',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e82,
    speedMbps: 480,
    port: 'USB Type-C 2.0 OTG',
    mode: 'Smart Connect Dual Screen + ADB',
    features: ['Pantalla externa 4.0"', 'Plegable Flex View', 'Snapdragon 8s Gen 3'],
    popular: true,
  },
  {
    id: 'moto-razr-50',
    brand: 'Motorola',
    series: 'Razr',
    model: 'Motorola Razr 50 / Razr 2024',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP Plegable / USB Tethering',
    features: ['Pantalla externa 3.6"', 'Diseño Flip Plegable'],
    popular: true,
  },
  {
    id: 'moto-razr-40-ultra',
    brand: 'Motorola',
    series: 'Razr',
    model: 'Motorola Razr 40 Ultra / Razr+ 2023',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e82,
    speedMbps: 480,
    port: 'USB-C 2.0 OTG',
    mode: 'Ready For / Smart Connect',
    features: ['Pantalla externa completa', 'Bisagra tipo gota'],
  },
  {
    id: 'moto-razr-40',
    brand: 'Motorola',
    series: 'Razr',
    model: 'Motorola Razr 40',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP / Depuración USB',
    features: ['Pantalla plegable OLED 144Hz'],
  },

  // --- Serie Moto G (Gama Media y Popular) ---
  {
    id: 'moto-g85-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G85 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0 OTG',
    mode: 'MTP + Smart Connect Link',
    features: ['Pantalla curva pOLED 120Hz', 'Cámara Sony LYTIA 600', 'Audio Dolby Atmos'],
    popular: true,
  },
  {
    id: 'moto-g84-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G84 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP / Transferencia de Archivos',
    features: ['Pantalla pOLED 10-bit', 'Batería 5000 mAh', 'Color Viva Magenta'],
    popular: true,
  },
  {
    id: 'moto-g75-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G75 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP + Depuración ADB',
    features: ['Snapdragon 6 Gen 3', 'Certificación Militar MIL-STD', 'Smart Connect'],
    popular: true,
  },
  {
    id: 'moto-g55-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G55 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP / USB ADB',
    features: ['Dimensity 7025', 'Pantalla 120Hz FHD+', 'Batería 5000 mAh'],
    popular: true,
  },
  {
    id: 'moto-g54-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G54 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP Composite USB',
    features: ['Batería hasta 6000 mAh', 'Cámara 50MP OIS', 'Conectividad 5G'],
    popular: true,
  },
  {
    id: 'moto-g35-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G35 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP / Depuración USB',
    features: ['Pantalla FHD+ 120Hz', 'Altavoces estéreo Dolby Atmos'],
  },
  {
    id: 'moto-g34-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G34 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0 OTG',
    mode: 'MTP / USB Tethering',
    features: ['Snapdragon 695 5G', '120Hz fluido', 'TurboPower'],
    popular: true,
  },
  {
    id: 'moto-g24-power',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G24 Power / Moto G24',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP Mass Storage',
    features: ['Batería masiva 6000 mAh', 'TurboPower 30W'],
  },
  {
    id: 'moto-g14',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G14',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP Device',
    features: ['Pantalla FHD+ 6.5"', 'Diseño resistente al agua'],
  },
  {
    id: 'moto-g-stylus-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G Stylus 5G (2024 / 2023)',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e82,
    speedMbps: 480,
    port: 'USB Type-C 2.0 OTG',
    mode: 'MTP + Lápiz Táctil Digitizer + ADB',
    features: ['Lápiz Stylus integrado', 'pOLED 120Hz', 'Carga inalámbrica'],
    popular: true,
  },
  {
    id: 'moto-g-power-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G Power 5G (2024)',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP / USB ADB',
    features: ['Batería 5000 mAh', 'Carga inalámbrica 15W', '5G'],
  },
  {
    id: 'moto-g73-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G73 5G',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB-C 2.0',
    mode: 'MTP Android',
    features: ['Dimensity 930 5G', 'Sensor Ultra Pixel 50MP'],
  },
  {
    id: 'moto-g200-5g',
    brand: 'Motorola',
    series: 'Moto G',
    model: 'Moto G200 5G (Ready For)',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e24,
    speedMbps: 480,
    port: 'USB Type-C 3.1 DisplayPort',
    mode: 'Motorola Ready For PC Docking',
    features: ['Snapdragon 888+', 'Ready For por cable USB', '144Hz'],
  },

  // --- Serie ThinkPhone by Motorola (Corporativo / ThinkShield) ---
  {
    id: 'moto-thinkphone-25',
    brand: 'Motorola',
    series: 'ThinkPhone',
    model: 'ThinkPhone 25 by Motorola (2024)',
    manufacturer: 'Motorola Mobility LLC / Lenovo',
    vendorId: 0x22b8,
    productId: 0x2e82,
    speedMbps: 480,
    port: 'USB Type-C 3.1 Gen 2 Smart Connect',
    mode: 'ThinkShield Security + PC Sync',
    features: ['ThinkShield Hardware Vault', 'Smart Connect con Lenovo ThinkPad', 'Fibra de aramida'],
    popular: true,
  },
  {
    id: 'moto-thinkphone-original',
    brand: 'Motorola',
    series: 'ThinkPhone',
    model: 'Lenovo ThinkPhone by Motorola',
    manufacturer: 'Motorola Mobility LLC / Lenovo',
    vendorId: 0x22b8,
    productId: 0x2e24,
    speedMbps: 480,
    port: 'USB Type-C 3.1 DisplayPort Out',
    mode: 'ThinkShield + Ready For Desktop',
    features: ['Botón Red Key programable', 'Grado Militar MIL-STD-810H', 'Ready For'],
    popular: true,
  },

  // --- Serie Moto E (Gama de Entrada) ---
  {
    id: 'moto-e14',
    brand: 'Motorola',
    series: 'Moto E',
    model: 'Moto E14',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP / USB Mass Storage',
    features: ['Pantalla 90Hz', 'Dolby Atmos', 'Batería 5000 mAh'],
  },
  {
    id: 'moto-e13',
    brand: 'Motorola',
    series: 'Moto E',
    model: 'Moto E13',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP Android Go',
    features: ['Android 13 Go Edition', 'Batería de larga duración'],
  },
  {
    id: 'moto-e22',
    brand: 'Motorola',
    series: 'Moto E',
    model: 'Moto E22 / E22i',
    manufacturer: 'Motorola Mobility LLC',
    vendorId: 0x22b8,
    productId: 0x2e76,
    speedMbps: 480,
    port: 'USB Type-C 2.0',
    mode: 'MTP File Transfer',
    features: ['Altavoces estéreo', 'Pantalla 90Hz'],
  },
];

/**
 * Other popular flagship presets (Samsung, Pixel, Apple, Xiaomi)
 */
export const OTHER_PHONE_PRESETS: UsbPhoneModel[] = [
  {
    id: 'samsung-s24-ultra',
    brand: 'Samsung',
    series: 'Galaxy',
    model: 'Samsung Galaxy S24 Ultra',
    manufacturer: 'Samsung Electronics',
    vendorId: 0x04e8,
    productId: 0x6860,
    speedMbps: 480,
    port: 'USB Type-C 3.2 Gen 2',
    mode: 'Samsung DeX / MTP + ADB',
    features: ['Galaxy AI', 'S-Pen', 'Titanio'],
    popular: true,
  },
  {
    id: 'google-pixel-9-pro',
    brand: 'Google',
    series: 'Pixel',
    model: 'Google Pixel 9 Pro',
    manufacturer: 'Google Inc.',
    vendorId: 0x18d1,
    productId: 0x4ee1,
    speedMbps: 480,
    port: 'USB-C Direct Link',
    mode: 'Depuración por USB (ADB Interface)',
    features: ['Tensor G4', 'Titan M2 Security'],
    popular: true,
  },
  {
    id: 'apple-iphone-16-pro',
    brand: 'Apple',
    series: 'iPhone',
    model: 'Apple iPhone 16 Pro',
    manufacturer: 'Apple Inc.',
    vendorId: 0x05ac,
    productId: 0x12a8,
    speedMbps: 480,
    port: 'USB-C Cable USB 3',
    mode: 'Apple Mobile Device USB Composite',
    features: ['A18 Pro', 'Apple Intelligence'],
    popular: true,
  },
  {
    id: 'xiaomi-14-ultra',
    brand: 'Xiaomi',
    series: 'Xiaomi',
    model: 'Xiaomi 14 Ultra',
    manufacturer: 'Xiaomi Inc.',
    vendorId: 0x2717,
    productId: 0xff48,
    speedMbps: 480,
    port: 'USB Type-C 3.2 OTG',
    mode: 'USB Tethering / ADB Shell',
    features: ['Óptica Leica', 'Snapdragon 8 Gen 3'],
    popular: true,
  },
];

/**
 * Lista combinada completa de todos los dispositivos soportados
 */
export const ALL_USB_PHONE_PRESETS: UsbPhoneModel[] = [
  ...MOTOROLA_PHONE_MODELS,
  ...OTHER_PHONE_PRESETS,
];

// Presets directos para compatibilidad con código existente
export const USB_PHONE_PRESETS = [
  MOTOROLA_PHONE_MODELS[0], // Edge 50 Ultra
  MOTOROLA_PHONE_MODELS[10], // Razr 50 Ultra
  MOTOROLA_PHONE_MODELS[14], // Moto G85 5G
  MOTOROLA_PHONE_MODELS[26], // ThinkPhone 25
  OTHER_PHONE_PRESETS[0], // Samsung S24 Ultra
  OTHER_PHONE_PRESETS[1], // Pixel 9 Pro
  OTHER_PHONE_PRESETS[2], // iPhone 16 Pro
  OTHER_PHONE_PRESETS[3], // Xiaomi 14 Ultra
];

/**
 * Obtener modelos Motorola filtrados por serie
 */
export function getMotorolaModels(series?: 'Edge' | 'Razr' | 'Moto G' | 'ThinkPhone' | 'Moto E'): UsbPhoneModel[] {
  if (!series) return MOTOROLA_PHONE_MODELS;
  return MOTOROLA_PHONE_MODELS.filter((m) => m.series === series);
}

/**
 * Buscar cualquier modelo de teléfono por texto
 */
export function searchPhoneModels(query: string, brandFilter?: string): UsbPhoneModel[] {
  const clean = query.trim().toLowerCase();
  let list = ALL_USB_PHONE_PRESETS;

  if (brandFilter && brandFilter !== 'all') {
    list = list.filter((item) => item.brand.toLowerCase() === brandFilter.toLowerCase());
  }

  if (!clean) return list;

  return list.filter(
    (item) =>
      item.model.toLowerCase().includes(clean) ||
      (item.series && item.series.toLowerCase().includes(clean)) ||
      item.manufacturer.toLowerCase().includes(clean) ||
      item.mode.toLowerCase().includes(clean) ||
      (item.features && item.features.some((f) => f.toLowerCase().includes(clean)))
  );
}

/**
 * Simular conexión USB para un modelo específico (Motorola u otro)
 */
export function simulateUsbPhone(targetModelOrIndex: string | number = 0): ConnectedUsbDevice {
  let selectedModel: UsbPhoneModel;

  if (typeof targetModelOrIndex === 'number') {
    selectedModel = ALL_USB_PHONE_PRESETS[targetModelOrIndex] || ALL_USB_PHONE_PRESETS[0];
  } else {
    selectedModel =
      ALL_USB_PHONE_PRESETS.find((m) => m.id === targetModelOrIndex || m.model.toLowerCase() === targetModelOrIndex.toLowerCase()) ||
      MOTOROLA_PHONE_MODELS[0];
  }

  return {
    id: `usb-sim-${selectedModel.vendorId}-${Date.now()}`,
    productName: selectedModel.model,
    manufacturerName: selectedModel.manufacturer,
    vendorId: selectedModel.vendorId,
    productId: selectedModel.productId,
    vendorIdHex: formatHexId(selectedModel.vendorId),
    productIdHex: formatHexId(selectedModel.productId),
    serialNumber: `MOTO-USB-${Math.floor(100000 + Math.random() * 900000)}`,
    connectionType: 'usb-cable',
    speedMbps: selectedModel.speedMbps,
    connectedAt: Date.now(),
    deviceClass: `${selectedModel.port} · ${selectedModel.mode}`,
  };
}
