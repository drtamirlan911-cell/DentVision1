import React, { useState, useEffect } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Database, Download, RefreshCw, CheckCircle, Clock, HardDrive, AlertTriangle, Shield } from 'lucide-react';
import { T, today } from '../utils/constants';
import * as api from '../utils/api';

export default function Backup() {
  const { clinic, user } = useOutletContext();
  const [backupData, setBackupData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [lastBackup, setLastBackup] = useState(null);
  const [error, setError] = useState(null);

  const createBackup = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.createBackup(clinic.id);
      setBackupData(data);
      setLastBackup(new Date());
    } catch (err) {
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
      <div className="page-header flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Database size={24} style={{ color: T.gold }} />
            Резервное копирование
          </h1>
          <p className="mt-1 text-sm text-slate-500">Создание и загрузка резервных копий данных клиники</p>
        </div>
      </div>

      {/* Backup Controls */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${T.gold}12` }}>
              <HardDrive size={18} style={{ color: T.gold }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Создать бэкап</p>
              <p className="text-xs text-slate-500">Все данные клиники</p>
            </div>
          </div>
          <button
            onClick={createBackup}
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-semibold text-black disabled:opacity-50"
            style={{ background: T.gold }}
          >
            {loading ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                Создание бэкапа...
              </>
            ) : (
              <>
                <Database size={14} />
                Создать резервную копию
              </>
            )}
          </button>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${T.emerald}12` }}>
              <Download size={18} style={{ color: T.emerald }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Скачать бэкап</p>
              <p className="text-xs text-slate-500">JSON-файл на компьютер</p>
            </div>
          </div>
          <button
            onClick={downloadBackup}
            disabled={!backupData}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 py-2.5 text-sm text-slate-400 hover:text-white disabled:opacity-30"
          >
            <Download size={14} />
            Скачать JSON
          </button>
        </div>

        <div className="rounded-xl border border-white/5 bg-white/[0.02] p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg" style={{ background: `${T.sapphire}12` }}>
              <Shield size={18} style={{ color: T.sapphire }} />
            </div>
            <div>
              <p className="text-sm font-bold text-white">Статус шифрования</p>
              <p className="text-xs text-slate-500">Защита данных пациентов</p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-[#27AE60]/8 border border-[#27AE60]/15 p-3">
            <CheckCircle size={14} className="text-[#27AE60]" />
            <span className="text-xs text-[#27AE60] font-semibold">AES-256-CBC шифрование активно</span>
          </div>
          <p className="mt-2 text-[10px] text-slate-600">Адрес, email и заметки пациентов зашифрованы</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[#E74C3C]/20 bg-[#E74C3C]/8 p-3">
          <AlertTriangle size={14} className="text-[#E74C3C]" />
          <span className="text-sm text-[#E74C3C]">{error}</span>
        </div>
      )}

      {/* Backup Results */}
      {backupData && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-white/5 bg-white/[0.02] p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <CheckCircle size={16} style={{ color: T.emerald }} />
              Бэкап создан успешно
            </h3>
            <span className="text-xs text-slate-500">
              {new Date().toLocaleString('ru-RU')}
            </span>
          </div>

          {metadata && (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-white">{metadata.tables}</p>
                <p className="text-[10px] uppercase text-slate-500">Таблиц</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-2xl font-bold text-[#C9A96E]">{metadata.records}</p>
                <p className="text-[10px] uppercase text-slate-500">Записей</p>
              </div>
              <div className="rounded-lg bg-white/5 p-3 text-center">
                <p className="text-sm font-bold text-white">{metadata.clinic_id}</p>
                <p className="text-[10px] uppercase text-slate-500">Клиника</p>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5">
                  <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">Таблица</th>
                  <th className="px-3 py-2 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">Записей</th>
                </tr>
              </thead>
              <tbody>
                {tableEntries.map(([table, rows]) => (
                  <tr key={table} className="border-b border-white/[0.03]">
                    <td className="px-3 py-2 text-xs text-white font-semibold">{table}</td>
                    <td className="px-3 py-2 text-right text-xs text-slate-400">
                      {Array.isArray(rows) ? rows.length : 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Info */}
      <div className="rounded-xl border border-[#2980B9]/15 bg-[#2980B9]/5 p-4">
        <h4 className="text-xs font-bold text-[#2980B9] mb-2">О резервном копировании</h4>
        <ul className="space-y-1 text-xs text-slate-400">
          <li>• Бэкап включает все таблицы клиники: пациенты, приёмы, лечения, документы, аудит-журнал</li>
          <li>• Данные зашифрованы (AES-256-CBC) перед сохранением на сервере</li>
          <li>• Рекомендуется создавать бэкап перед каждым обновлением системы</li>
          <li>• Храните резервные копии в безопасном месте (не на сервере)</li>
        </ul>
      </div>
    </div>
  );
}
