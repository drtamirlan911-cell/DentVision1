import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react';
import { Card } from '@/components/ui/ds/Card';
import { Badge } from '@/components/ui/ds/Badge';
import { Skeleton } from '@/components/ui/ds/Skeleton';
import { useAuth } from '@/store/auth.store';
import { queryKeys } from '@/queries/keys';
import * as api from '@/utils/api';
import { cn } from '@/lib/utils';

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export default function DiagnosticCalendar() {
  const navigate = useNavigate();
  const { clinic, activeMembership } = useAuth();
  const clinicId = clinic?.id || activeMembership?.clinicId || '';
  const [date, setDate] = useState(new Date());

  const year = date.getFullYear();
  const month = date.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startPad = (firstDay.getDay() + 6) % 7;
  const daysInMonth = lastDay.getDate();

  const weeks: (number | null)[][] = [];
  let row: (number | null)[] = Array(startPad).fill(null);
  for (let d = 1; d <= daysInMonth; d++) {
    row.push(d);
    if (row.length === 7) { weeks.push(row); row = []; }
  }
  if (row.length > 0) { while (row.length < 7) row.push(null); weeks.push(row); }

  const monthStart = new Date(year, month, 1).toISOString().slice(0, 10);
  const monthEnd = new Date(year, month + 1, 0).toISOString().slice(0, 10);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.diagnostics.referrals({ clinicId, limit: '200' }),
    queryFn: () => api.getDiagnosticReferrals({ clinicId, limit: '200' }),
    enabled: !!clinicId,
  });

  const referralsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    (data?.items || []).forEach((r: any) => {
      const d = r.scheduledDate ? new Date(r.scheduledDate).toISOString().slice(0, 10) : new Date(r.createdAt).toISOString().slice(0, 10);
      if (!map[d]) map[d] = [];
      map[d].push(r);
    });
    return map;
  }, [data]);

  const prevMonth = () => setDate(new Date(year, month - 1, 1));
  const nextMonth = () => setDate(new Date(year, month + 1, 1));
  const today = new Date().toISOString().slice(0, 10);

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="p-6 space-y-4 max-w-full overflow-x-hidden">
      <h1 className="text-xl font-bold text-txt-primary">Календарь</h1>

      <Card padding="md">
        <div className="flex flex-wrap items-center justify-between mb-4 gap-2">
          <button aria-label="Previous month" onClick={prevMonth} className="p-1.5 min-h-11 min-w-11 rounded-lg hover:bg-surface-1 text-txt-muted"><ChevronLeft size={18} /></button>
          <h2 className="text-base font-bold text-txt-primary">{MONTHS[month]} {year}</h2>
          <button aria-label="Next month" onClick={nextMonth} className="p-1.5 min-h-11 min-w-11 rounded-lg hover:bg-surface-1 text-txt-muted"><ChevronRight size={18} /></button>
        </div>

        <div className="overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
          <div className="grid grid-cols-7 gap-1 min-w-[560px]">
            {DAYS.map(d => <div key={d} className="text-center text-xs font-bold text-txt-muted py-2">{d}</div>)}
            {weeks.flat().map((d, i) => {
              const dateStr = d ? `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}` : '';
              const dayRefs = dateStr ? referralsByDate[dateStr] : undefined;
              const isToday = dateStr === today;
              return (
                <div key={i} className={cn('min-h-[70px] p-1 rounded-lg border border-transparent', isToday && 'border-dv-gold/30 bg-dv-gold/5')}>
                  {d && (
                    <>
                      <div className="text-xs font-medium text-txt-primary mb-1">{d}</div>
                      {dayRefs && (
                        <div className="space-y-0.5">
                          {dayRefs.slice(0, 3).map((r: any) => (
                            <div key={r.id} onClick={() => navigate(`/diagnostics/referrals/${r.id}`)}
                              className="text-[9px] px-1 py-0.5 rounded bg-dv-gold/10 text-dv-gold truncate cursor-pointer hover:bg-dv-gold/20">
                              {r.patientName?.split(' ')[0]}
                            </div>
                          ))}
                          {dayRefs.length > 3 && <div className="text-[9px] text-txt-ghost px-1">+{dayRefs.length - 3}</div>}
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
