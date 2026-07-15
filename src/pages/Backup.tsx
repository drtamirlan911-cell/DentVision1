import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Database, Download, RefreshCw, CheckCircle, Clock, HardDrive, AlertTriangle, Shield } from 'lucide-react';
import { today } from '../utils/constants';
import * as api from '../utils/api';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/ds/Card';
import { Button } from '../components/ui/ds/Button';
import { Badge } from '../components/ui/ds/Badge';
import { PageHeader } from '../components/ui/ds/StatCard';
import type { Clinic, User, RoleInfo } from '../types';

export default function Backup() {
  const { clinic, user } = useOutletContext<{ clinic: Clinic; user: User; roleInfo: RoleInfo }>();
  const [backupData, setBackupData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createBackup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.createBackup(clinic.id);
      setBackupData(data);
      setLastBackup(new Date());
    } catch (err: any) {
      setError(err.message || 'Ошибка создания бэкапа');
    } finally {
      setLoading(false);
    }
  };

  const downloadBackup = () => {
    if (!backupData) return;
    const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `dentvision_backup_${clinic.id}_${new Date().toISOString().slice(0,10)}.json`;
    link.click();
  };

  const tableEntries = backupData ? Object.entries(backupData).filter(([k]) => k !== 'metadata') : [];
  const metadata = backupData?.metadata;

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="Резервное копирование"
        subtitle="Создание и загрузка резервных копий данных клиники"
        icon={<Database size={24} className="text-dv-gold" />}
      />

      {/* Backup Controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dv-gold/10">
              <HardDrive size={18} className="text-dv-gold" />
            </div>
            <div>
              <p className="text-sm font-bold text-txt-primary">Создать бэкап</p>
              <p className="text-xs text-txt-muted">Все данные клиники</p>
            </div>
          </div>
          <Button
            variant="primary"
            className="w-full"
            loading={loading}
            icon={!loading ? <Database size={14} /> : undefined}
            onClick={createBackup}
          >
            Создать резервную копию
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10">
              <Download size={18} className="text-emerald-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-txt-primary">Скачать бэкап</p>
              <p className="text-xs text-txt-muted">JSON-файл на компьютер</p>
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            disabled={!backupData}
            icon={<Download size={14} />}
            onClick={downloadBackup}
          >
            Скачать JSON
          </Button>
        </Card>

        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-500/10">
              <Shield size={18} className="text-sky-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-txt-primary">Статус шифрования</p>
              <p className="text-xs text-txt-muted">Защита данных пациентов</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 p-3">
            <CheckCircle size={14} className="text-emerald-400" />
            <span className="text-xs text-emerald-400 font-semibold">AES-256-CBC шифрование активно</span>
          </div>
          <p className="mt-2 text-[10px] text-txt-ghost">Адрес, email и заметки пациентов зашифрованы</p>
        </Card>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-error/20 bg-error/8 p-3">
          <AlertTriangle size={14} className="text-error" />
          <span className="text-sm text-error">{error}</span>
        </div>
      )}

      {/* Backup Results */}
      {backupData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <CheckCircle size={16} className="text-emerald-400" />
                  Бэкап создан успешно
                </span>
                <span className="text-xs text-txt-muted">
                  {new Date().toLocaleString('ru-RU')}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {metadata && (
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-2xl font-bold text-txt-primary">{metadata.tables}</p>
                      <p className="text-[10px] uppercase text-txt-muted">Таблиц</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-2xl font-bold text-dv-gold">{metadata.records}</p>
                      <p className="text-[10px] uppercase text-txt-muted">Записей</p>
                    </div>
                    <div className="rounded-lg bg-white/5 p-3 text-center">
                      <p className="text-sm font-bold text-txt-primary">{metadata.clinic_id}</p>
                      <p className="text-[10px] uppercase text-txt-muted">Клиника</p>
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-bdr-subtle">
                        <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-txt-muted">Таблица</th>
                        <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-txt-muted">Записей</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableEntries.map(([table, rows]) => (
                        <tr key={table} className="border-b border-white/[0.03]">
                          <td className="px-3 py-2 text-xs text-txt-primary font-semibold">{table}</td>
                          <td className="px-3 py-2 text-right text-xs text-txt-secondary">
                            {Array.isArray(rows) ? rows.length : 0}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Info */}
      <Card className="border-sky-500/15 bg-sky-500/5">
        <CardContent className="p-4">
          <h4 className="text-xs font-bold text-sky-400 mb-2">О резервном копировании</h4>
          <ul className="space-y-1 text-xs text-txt-secondary">
            <li>• Бэкап включает все таблицы клиники: пациенты, приёмы, лечения, документы, аудит-журнал</li>
            <li>• Данные зашифрованы (AES-256-CBC) перед сохранением на сервере</li>
            <li>• Рекомендуется создавать бэкап перед каждым обновлением системы</li>
            <li>• Храните резервные копии в безопасном месте (не на сервере)</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
