export const PLATFORM_INFO: Record<string, string> = {
  PlatformName: 'ТОО «DentVision»',
  PlatformDirector: 'Тамирлан Нариманулы',

  PLATFORM_BIN: '123456789012',
  PLATFORM_ADDRESS: 'Республика Казахстан, г. Алматы, ул. Достык, д. 200',
  PLATFORM_PHONE: '+7 (727) 111-22-33',
  PLATFORM_EMAIL: 'legal@dentvision.kz',
  PLATFORM_IBAN: 'KZ123456789012345678',
  PLATFORM_BANK: 'Kaspi Bank',
  PLATFORM_BIC: 'KASPKZKA',
  PLATFORM_KBE: '17',

  DentVisionBIN: '123456789012',
  DentVisionAddress: 'Республика Казахстан, г. Алматы, ул. Достык, д. 200',
  DentVisionAccount: 'KZ123456789012345678',
  DentVisionBank: 'Kaspi Bank',
  DentVisionBIC: 'KASPKZKA',
  DentVisionPhone: '+7 (727) 111-22-33',
  DentVisionEmail: 'legal@dentvision.kz',

  PlatformDirectorTitle: 'Директор',
  PlatformDirectorDoc: 'Устава',

  MarketplaceCommission: '3%',
  Komissiya: '3% от суммы Заказа',

  Plan: 'STANDARD',
};

export function buildPlatformVars(): Record<string, any> {
  const now = new Date();
  const fmt = (d: Date) => d.toLocaleDateString('ru-RZ', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return {
    ...PLATFORM_INFO,
    DocumentDate: fmt(now),
    ContractDate: fmt(now),
    ToSDate: fmt(now),
    PolicyDate: fmt(now),
    AIPolicyDate: fmt(now),
    CookiePolicyDate: fmt(now),
    OfferDate: fmt(now),
  };
}
