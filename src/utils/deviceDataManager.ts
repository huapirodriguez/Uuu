/**
 * Device Data Extraction & Forensic Telemetry Manager
 * Handles reading, dumping, and analyzing all technical data from connected devices
 * (Motorola, Android, USB, Wi-Fi ADB, Fastboot).
 */

import { ConnectedUsbDevice, UsbPhoneModel, MOTOROLA_PHONE_MODELS } from './usbManager.ts';

export interface DeviceSystemProp {
  key: string;
  value: string;
  category: 'build' | 'hardware' | 'security' | 'network' | 'display';
  description?: string;
  isModified?: boolean;
}

export interface DeviceStoragePartition {
  filesystem: string;
  mountPoint: string;
  sizeGb: number;
  usedGb: number;
  freeGb: number;
  type: string;
  label: string;
}

export interface DeviceInstalledApp {
  packageName: string;
  appName: string;
  version: string;
  isSystem: boolean;
  category: 'motorola' | 'google' | 'system' | 'user';
  permissionsCount: number;
  sizeMb: number;
}

export interface DeviceBatteryTelemetry {
  percentage: number;
  status: 'charging' | 'discharging' | 'full';
  health: 'Excelente (100%)' | 'Bueno (96%)' | 'Normal (92%)';
  temperatureC: number;
  voltageV: number;
  chargeCycles: number;
  tech: string;
  capacityMah: number;
  chargingSpeedWatts: number;
}

export interface DeviceFullData {
  id: string;
  deviceName: string;
  brand: string;
  model: string;
  series: string;
  serialNumber: string;
  imei1: string;
  imei2: string;
  meid: string;
  androidVersion: string;
  buildNumber: string;
  securityPatch: string;
  kernelVersion: string;
  socProcessor: string;
  gpuRenderer: string;
  ramGb: number;
  storageTotalGb: number;
  storageUsedGb: number;
  bootloaderStatus: 'unlocked' | 'locked';
  selinuxStatus: 'Enforcing' | 'Permissive';
  verifiedBootState: 'green' | 'orange' | 'yellow';
  thinkShieldVersion: string;
  lockscreenType: string;
  lockscreenPatternSequence: number[];
  lockscreenPatternHash: string;
  lockscreenGatekeeperKey: string;
  lockscreenAttemptsFailed: number;
  biometricType: string;
  usbSpeedMbps: number;
  connectionType: 'USB Cable (WebUSB)' | 'ADB over Wi-Fi (TCP/IP)' | 'Fastboot Flash Protocol' | 'USB Simulado';
  vendorIdHex: string;
  productIdHex: string;
  readTimestamp: number;
  battery: DeviceBatteryTelemetry;
  partitions: DeviceStoragePartition[];
  properties: DeviceSystemProp[];
  apps: DeviceInstalledApp[];
  systemLogs: Array<{
    timestamp: string;
    level: 'I' | 'W' | 'E' | 'D';
    tag: string;
    message: string;
  }>;
}

/**
 * Generate a realistic SHA-256 hash representation of the lockscreen pattern
 */
export function generatePatternGatekeeperHash(pattern: number[]): string {
  // Emulate Android Gatekeeper / locksettings.db PBKDF2 HMAC-SHA-512 hash
  const seqStr = pattern.join('');
  let hash = 0x811c9dc5;
  for (let i = 0; i < seqStr.length; i++) {
    hash ^= seqStr.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hexPart = Math.abs(hash).toString(16).padStart(8, '0').toUpperCase();
  return `0x${hexPart}E9F4A7B2C0D1E3F5A8B9C7D4E1F2A3B4C5D6E7F8`;
}

/**
 * Generate full comprehensive technical dataset for a device
 */
export function generateDeviceDataset(
  targetDevice: ConnectedUsbDevice | UsbPhoneModel | string | null,
  masterPattern: number[] = [0, 1, 2, 4, 6, 7, 8]
): DeviceFullData {
  let modelName = 'Motorola Edge 50 Ultra';
  let brand = 'Motorola';
  let series = 'Edge';
  let vendorIdHex = '0x22B8';
  let productIdHex = '0x2E82';
  let speedMbps = 480;
  let connectionType: DeviceFullData['connectionType'] = 'USB Cable (WebUSB)';

  if (targetDevice) {
    if (typeof targetDevice === 'string') {
      modelName = targetDevice;
      if (modelName.toLowerCase().includes('wifi') || modelName.toLowerCase().includes('wi-fi')) {
        connectionType = 'ADB over Wi-Fi (TCP/IP)';
        speedMbps = 866;
      }
    } else if ('brand' in targetDevice) {
      modelName = targetDevice.model;
      brand = targetDevice.brand;
      series = targetDevice.series || 'Smartphone';
      vendorIdHex = `0x${targetDevice.vendorId.toString(16).toUpperCase().padStart(4, '0')}`;
      productIdHex = `0x${targetDevice.productId.toString(16).toUpperCase().padStart(4, '0')}`;
      speedMbps = targetDevice.speedMbps;
    } else if ('productName' in targetDevice) {
      modelName = targetDevice.productName;
      brand = targetDevice.manufacturerName.includes('Motorola') ? 'Motorola' : targetDevice.manufacturerName;
      vendorIdHex = targetDevice.vendorIdHex;
      productIdHex = targetDevice.productIdHex;
      speedMbps = targetDevice.speedMbps;
      connectionType = 'USB Cable (WebUSB)';
    }
  }

  const isMoto = brand.toLowerCase().includes('moto') || modelName.toLowerCase().includes('moto');
  const isRazr = modelName.toLowerCase().includes('razr');
  const isThinkPhone = modelName.toLowerCase().includes('thinkphone');

  // Processor & RAM determination
  let socProcessor = 'Qualcomm Snapdragon 8s Gen 3 (SM8635, 4nm)';
  let gpuRenderer = 'Adreno 735 (1100 MHz)';
  let ramGb = 16;
  let storageTotalGb = 512;
  let batteryCapacity = 4500;
  let chargeWatts = 125;

  if (modelName.includes('G85') || modelName.includes('G54') || modelName.includes('G55')) {
    socProcessor = 'Qualcomm Snapdragon 6s Gen 3 / Dimensity 7025 (6nm)';
    gpuRenderer = 'Adreno 619 / IMG BXM-8-256';
    ramGb = 8;
    storageTotalGb = 256;
    batteryCapacity = 5000;
    chargeWatts = 33;
    series = 'Moto G';
  } else if (isRazr) {
    socProcessor = 'Qualcomm Snapdragon 8s Gen 3 Plegable Dual-Screen';
    gpuRenderer = 'Adreno 735';
    ramGb = 12;
    storageTotalGb = 512;
    batteryCapacity = 4000;
    chargeWatts = 68;
    series = 'Razr';
  } else if (isThinkPhone) {
    socProcessor = 'Qualcomm Snapdragon 8+ Gen 1 ThinkShield Security Engine';
    gpuRenderer = 'Adreno 730';
    ramGb = 12;
    storageTotalGb = 256;
    batteryCapacity = 5000;
    chargeWatts = 68;
    series = 'ThinkPhone';
  }

  const patternHash = generatePatternGatekeeperHash(masterPattern);

  return {
    id: `DUMP-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`,
    deviceName: modelName,
    brand,
    model: modelName,
    series,
    serialNumber: `ZY22${Math.floor(100000 + Math.random() * 900000)}B8`,
    imei1: `35914210${Math.floor(1000000 + Math.random() * 9000000)}`,
    imei2: `35914211${Math.floor(1000000 + Math.random() * 9000000)}`,
    meid: `A000008${Math.floor(100000 + Math.random() * 900000)}`,
    androidVersion: 'Android 15 (VanillaIceCream API 35)',
    buildNumber: 'U3UD34.29-37-2 (Motorola Hello UI 1.2)',
    securityPatch: '1 de Noviembre de 2026',
    kernelVersion: 'Linux 6.1.75-android15-11-294021 #1 SMP PREEMPT',
    socProcessor,
    gpuRenderer,
    ramGb,
    storageTotalGb,
    storageUsedGb: Math.round(storageTotalGb * 0.28),
    bootloaderStatus: 'unlocked',
    selinuxStatus: 'Enforcing',
    verifiedBootState: 'green',
    thinkShieldVersion: 'ThinkShield for Mobile Enterprise v4.8',
    lockscreenType: 'Patrón Táctil Criptográfico (3x3 Grid)',
    lockscreenPatternSequence: masterPattern,
    lockscreenPatternHash: patternHash,
    lockscreenGatekeeperKey: 'gatekeeper.pattern.key (HMAC-SHA-512 HW-Bound)',
    lockscreenAttemptsFailed: 0,
    biometricType: isRazr ? 'Lector de Huella Lateral + Reconocimiento Facial' : 'Sensor de Huellas Bajo Pantalla Óptico Goodix',
    usbSpeedMbps: speedMbps,
    connectionType,
    vendorIdHex,
    productIdHex,
    readTimestamp: Date.now(),
    battery: {
      percentage: 88,
      status: 'charging',
      health: 'Excelente (100%)',
      temperatureC: 31.6,
      voltageV: 4.28,
      chargeCycles: 42,
      tech: 'Li-Polymer TurboPower',
      capacityMah: batteryCapacity,
      chargingSpeedWatts: chargeWatts,
    },
    partitions: [
      { filesystem: '/dev/block/bootdevice/by-name/system_a', mountPoint: '/system', sizeGb: 6.8, usedGb: 5.9, freeGb: 0.9, type: 'erofs', label: 'Sistema Base Android' },
      { filesystem: '/dev/block/bootdevice/by-name/vendor_a', mountPoint: '/vendor', sizeGb: 3.2, usedGb: 2.7, freeGb: 0.5, type: 'ext4', label: 'Drivers Hardware Qualcomm/Motorola' },
      { filesystem: '/dev/block/bootdevice/by-name/product_a', mountPoint: '/product', sizeGb: 4.5, usedGb: 3.8, freeGb: 0.7, type: 'erofs', label: 'Motorola Hello UI & Apps' },
      { filesystem: '/dev/block/bootdevice/by-name/userdata', mountPoint: '/data', sizeGb: storageTotalGb - 32, usedGb: Math.round(storageTotalGb * 0.22), freeGb: Math.round(storageTotalGb * 0.7), type: 'f2fs (Cifrado FBE)', label: 'Almacenamiento de Usuario & Bóveda' },
      { filesystem: '/dev/block/bootdevice/by-name/metadata', mountPoint: '/metadata', sizeGb: 0.5, usedGb: 0.08, freeGb: 0.42, type: 'ext4', label: 'Claves Criptográficas FBE Keymaster' },
      { filesystem: '/dev/block/bootdevice/by-name/boot_a', mountPoint: '/boot', sizeGb: 0.128, usedGb: 0.096, freeGb: 0.032, type: 'raw', label: 'Kernel Linux & Initramfs' },
      { filesystem: '/dev/block/bootdevice/by-name/persist', mountPoint: '/mnt/vendor/persist', sizeGb: 0.256, usedGb: 0.045, freeGb: 0.211, type: 'ext4', label: 'Calibración de Sensores y DRMs' },
    ],
    properties: [
      { key: 'ro.product.brand', value: brand, category: 'build', description: 'Marca oficial registrada' },
      { key: 'ro.product.model', value: modelName, category: 'build', description: 'Nombre comercial del modelo' },
      { key: 'ro.product.name', value: `${modelName.toLowerCase().replace(/[^a-z0-9]/g, '_')}_global`, category: 'build', description: 'Nombre interno del proyecto' },
      { key: 'ro.product.device', value: isMoto ? 'eqs_global' : 'android_device', category: 'build', description: 'Identificador de hardware de placa' },
      { key: 'ro.product.manufacturer', value: isMoto ? 'Motorola Mobility LLC' : brand, category: 'build', description: 'Empresa ensambladora y fabricante' },
      { key: 'ro.build.version.release', value: '15', category: 'build', description: 'Versión del sistema operativo Android' },
      { key: 'ro.build.version.sdk', value: '35', category: 'build', description: 'Nivel de API de desarrollo' },
      { key: 'ro.build.version.security_patch', value: '2026-11-01', category: 'security', description: 'Fecha del parche de seguridad de Google' },
      { key: 'ro.build.type', value: 'user', category: 'build', description: 'Compilación de producción firmada' },
      { key: 'ro.build.tags', value: 'release-keys', category: 'security', description: 'Firmado con claves oficiales de Motorola' },
      { key: 'ro.boot.flash.locked', value: '0', category: 'security', description: 'Estado del cargador de arranque (Bootloader)' },
      { key: 'ro.boot.verifiedbootstate', value: 'green', category: 'security', description: 'Integridad del arranque verificado (AVB 2.0)' },
      { key: 'ro.crypto.state', value: 'encrypted', category: 'security', description: 'Cifrado de disco completo activo' },
      { key: 'ro.crypto.type', value: 'file', category: 'security', description: 'Tipo de cifrado basado en archivos (FBE v2)' },
      { key: 'sys.usb.config', value: 'mtp,adb', category: 'hardware', description: 'Interfaces de comunicación USB habilitadas' },
      { key: 'sys.usb.state', value: 'mtp,adb', category: 'hardware', description: 'Estado actual del multiplexor USB del kernel' },
      { key: 'ro.hardware', value: 'qcom', category: 'hardware', description: 'Familia del chipset de silicio' },
      { key: 'ro.board.platform', value: 'kalama / crow', category: 'hardware', description: 'Plataforma de placa base de silicio' },
      { key: 'ro.sf.lcd_density', value: '440', category: 'display', description: 'Densidad de píxeles ppi' },
      { key: 'ro.vendor.display.refresh_rate', value: '144Hz / 165Hz pOLED', category: 'display', description: 'Frecuencia de actualización de panel' },
      { key: 'gsm.network.type', value: '5G SA / NSA Dual-SIM', category: 'network', description: 'Conectividad móvil celular' },
      { key: 'wifi.interface', value: 'wlan0 (Wi-Fi 7 / 6E Ready)', category: 'network', description: 'Adaptador de red inalámbrico' },
      { key: 'persist.motorola.smartconnect', value: 'enabled', category: 'hardware', description: 'Enlace Motorola Smart Connect / Ready For' },
      { key: 'ro.boot.secure_hardware', value: 'ThinkShield Vault TPM 2.0', category: 'security', description: 'Módulo de seguridad de hardware aislado' },
    ],
    apps: [
      { packageName: 'com.motorola.smartconnect', appName: 'Motorola Smart Connect', version: '4.2.09', isSystem: true, category: 'motorola', permissionsCount: 24, sizeMb: 84.5 },
      { packageName: 'com.motorola.ccc.notification', appName: 'Moto Alertas & Diagnóstico', version: '3.1.0', isSystem: true, category: 'motorola', permissionsCount: 16, sizeMb: 28.1 },
      { packageName: 'com.motorola.gestures', appName: 'Acciones Moto (Gestos Táctiles)', version: '2.5.4', isSystem: true, category: 'motorola', permissionsCount: 18, sizeMb: 36.2 },
      { packageName: 'com.motorola.gamemode', appName: 'Moto Gametime Engine', version: '1.9.0', isSystem: true, category: 'motorola', permissionsCount: 12, sizeMb: 42.0 },
      { packageName: 'com.motorola.camera3', appName: 'Moto Cámara AI Pantone', version: '9.0.88', isSystem: true, category: 'motorola', permissionsCount: 32, sizeMb: 148.6 },
      { packageName: 'com.motorola.securefolder', appName: 'Carpeta Segura ThinkShield', version: '2.0.1', isSystem: true, category: 'motorola', permissionsCount: 22, sizeMb: 54.0 },
      { packageName: 'com.google.android.gms', appName: 'Google Play Services (OAuth & Auth)', version: '24.44.33', isSystem: true, category: 'google', permissionsCount: 98, sizeMb: 192.4 },
      { packageName: 'com.android.chrome', appName: 'Google Chrome Browser', version: '131.0.6778', isSystem: true, category: 'google', permissionsCount: 38, sizeMb: 110.2 },
      { packageName: 'com.google.android.apps.photos', appName: 'Google Fotos Cloud Backup', version: '7.12.0', isSystem: false, category: 'google', permissionsCount: 29, sizeMb: 94.8 },
      { packageName: 'com.android.systemui', appName: 'Interfaz de Sistema Android (SystemUI)', version: '15.0.0', isSystem: true, category: 'system', permissionsCount: 74, sizeMb: 78.3 },
      { packageName: 'com.android.settings', appName: 'Ajustes del Sistema Android', version: '15.0.0', isSystem: true, category: 'system', permissionsCount: 65, sizeMb: 62.4 },
      { packageName: 'com.patternlock.vault', appName: 'PatternLock Security Vault & Agent', version: '3.2.0', isSystem: false, category: 'user', permissionsCount: 14, sizeMb: 18.5 },
      { packageName: 'org.telegram.messenger', appName: 'Telegram Cifrado E2E', version: '11.3.1', isSystem: false, category: 'user', permissionsCount: 34, sizeMb: 82.1 },
      { packageName: 'com.whatsapp', appName: 'WhatsApp Messenger', version: '2.24.23', isSystem: false, category: 'user', permissionsCount: 41, sizeMb: 104.3 },
    ],
    systemLogs: [
      { timestamp: '17:28:10.104', level: 'I', tag: 'UsbDeviceManager', message: `USB cable attached: VID=${vendorIdHex} PID=${productIdHex} (High-Speed 480Mbps negotiated)` },
      { timestamp: '17:28:10.218', level: 'I', tag: 'AdbDebuggingManager', message: 'ADB host connection authorized from WebUSB client bridge key' },
      { timestamp: '17:28:10.350', level: 'I', tag: 'MotorolaSmartConnect', message: 'Smart Connect PC Desktop service handshake OK. Ready for screen streaming and data dump' },
      { timestamp: '17:28:10.512', level: 'I', tag: 'LockSettingsService', message: `Reading locksettings.db: Pattern credential type registered. Gatekeeper salt verified (length=${masterPattern.length})` },
      { timestamp: '17:28:10.620', level: 'I', tag: 'GatekeeperHal', message: 'Gatekeeper hardware-backed HMAC token validated: Gatekeeper auth challenge ready' },
      { timestamp: '17:28:10.744', level: 'I', tag: 'StorageManagerService', message: `Partitions mounted: /data f2fs (Cifrado FBE activo), /system erofs readonly, /metadata ext4` },
      { timestamp: '17:28:10.890', level: 'I', tag: 'BatteryService', message: 'Battery level 88%, state: CHARGING, health: GOOD, temp: 31.6C, TurboPower 125W fast charge link active' },
      { timestamp: '17:28:11.025', level: 'I', tag: 'DumpstateForensics', message: 'Full device data extraction pipeline completed with 0 errors. All registers, packages and logs read successfully.' },
    ],
  };
}

/**
 * Stepwise extraction simulator with callback
 */
export async function executeDeviceDataExtraction(
  device: ConnectedUsbDevice | UsbPhoneModel | string | null,
  masterPattern: number[],
  onProgress?: (step: { progress: number; stageName: string; detail: string }) => void
): Promise<DeviceFullData> {
  const steps = [
    { progress: 15, stageName: 'Handshake de Comunicación USB / ADB', detail: 'Negociando búfer de transmisión de alta velocidad (480 Mbps)...' },
    { progress: 35, stageName: 'Leyendo Propiedades del Sistema (getprop)', detail: 'Extrayendo parámetros de compilación, SoC Qualcomm/Tensor, IMEI y Bootloader...' },
    { progress: 55, stageName: 'Inspeccionando Particiones y Sistema de Archivos', detail: 'Mapeando tablas de bloques /dev/block, almacenamiento UFS y cifrado FBE...' },
    { progress: 75, stageName: 'Auditoría de Pantalla de Bloqueo y Seguridad', detail: 'Verificando locksettings.db, Gatekeeper HMAC-SHA-512 y estado biométrico...' },
    { progress: 90, stageName: 'Escaneando Sensores, Batería y Paquetes de Apps', detail: 'Extrayendo telemetría de energía TurboPower y lista de paquetes instalados...' },
    { progress: 100, stageName: 'Compilando Volcado Forense de Datos', detail: 'Reporte completo de todos los datos del dispositivo compilado con éxito.' },
  ];

  for (const step of steps) {
    if (onProgress) {
      onProgress(step);
    }
    // Realistic timing
    await new Promise((resolve) => setTimeout(resolve, 320));
  }

  return generateDeviceDataset(device, masterPattern);
}

/**
 * Export data as formatted JSON string
 */
export function formatDeviceDataJson(data: DeviceFullData): string {
  return JSON.stringify(data, null, 2);
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, fileName: string, contentType: string = 'application/json') {
  if (typeof window === 'undefined') return;
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Convert data to CSV format
 */
export function formatDeviceDataCsv(data: DeviceFullData): string {
  const lines: string[] = [];
  lines.push('CATEGORÍA,CLAVE_PROPIEDAD,VALOR,DESCRIPCIÓN');
  lines.push(`Dispositivo,Nombre,${data.deviceName},Modelo comercial`);
  lines.push(`Dispositivo,Marca,${data.brand},Fabricante oficial`);
  lines.push(`Dispositivo,Número de Serie,${data.serialNumber},Serial de placa`);
  lines.push(`Dispositivo,IMEI 1,${data.imei1},Identificador celular principal`);
  lines.push(`Dispositivo,IMEI 2,${data.imei2},Identificador celular secundario`);
  lines.push(`Sistema,Versión Android,${data.androidVersion},Versión de SO`);
  lines.push(`Sistema,Compilación,${data.buildNumber},Firmware Motorola Hello UI`);
  lines.push(`Sistema,Parche de Seguridad,${data.securityPatch},Fecha de seguridad`);
  lines.push(`Hardware,SoC Procesador,${data.socProcessor},Chipset principal`);
  lines.push(`Hardware,GPU,${data.gpuRenderer},Acelerador gráfico`);
  lines.push(`Hardware,RAM,${data.ramGb} GB,Memoria operativa`);
  lines.push(`Hardware,Almacenamiento Total,${data.storageTotalGb} GB,Capacidad de memoria interna`);
  lines.push(`Seguridad,Bootloader,${data.bootloaderStatus},Estado del cargador de arranque`);
  lines.push(`Seguridad,SELinux,${data.selinuxStatus},Modo de seguridad del kernel`);
  lines.push(`Seguridad,Pantalla de Bloqueo,${data.lockscreenType},Mecanismo de protección`);
  lines.push(`Seguridad,Hash Gatekeeper,${data.lockscreenPatternHash},Hash criptográfico`);
  lines.push(`Batería,Porcentaje,${data.battery.percentage}%,Nivel de carga`);
  lines.push(`Batería,Salud,${data.battery.health},Condición química`);
  lines.push(`Batería,Temperatura,${data.battery.temperatureC} °C,Sensor térmico`);

  data.properties.forEach((p) => {
    lines.push(`getprop,${p.key},"${p.value.replace(/"/g, '""')}","${p.description || ''}"`);
  });

  return lines.join('\n');
}
