import React, { useState, useRef, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity, 
  Brain, 
  MessageSquare, 
  Send, 
  BarChart3, 
  PieChart, 
  Zap, 
  Target, 
  DollarSign, 
  Users 
} from 'lucide-react';
import { 
  StatCard, 
  PageHeader, 
  GlassCard, 
  Card, 
  CardContent, 
  Button, 
  Badge, 
  Input, 
  Skeleton, 
  EmptyState 
} from '../../components/ui/ds';
import { 
  LineChartComponent, 
  BarChartComponent, 
  DonutChartComponent, 
  AreaChartComponent 
} from '../../components/charts';
import * as api from '../../utils/api';

type SubTab = 'overview' | 'aifinance' | 'scenarios';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M ₸`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K ₸`;
  }
  return `${value.toFixed(0)} ₸`;
};

const formatPercentage = (value: number): string => {
  return `${value.toFixed(1)}%`;
};

export default function BITab() {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('overview');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  const { data: dashboardData, isLoading: dashboardLoading } = useQuery({
    queryKey: ['bi-dashboard'],
    queryFn: () => api.biDashboard(),
  });

  const { data: mrrData, isLoading: mrrLoading } = useQuery({
    queryKey: ['bi-mrr'],
    queryFn: () => api.biMRR(),
  });

  const { data: churnData, isLoading: churnLoading } = useQuery({
    queryKey: ['bi-churn'],
    queryFn: () => api.biChurn(),
  });

  const { data: ltvData, isLoading: ltvLoading } = useQuery({
    queryKey: ['bi-ltv'],
    queryFn: () => api.biLTV(),
  });

  const { data: cacData, isLoading: cacLoading } = useQuery({
    queryKey: ['bi-cac'],
    queryFn: () => api.biCAC(),
  });

  const { data: unitEconomicsData, isLoading: unitEconomicsLoading } = useQuery({
    queryKey: ['bi-unit-economics'],
    queryFn: () => api.biUnitEconomics(),
  });

  const { data: cashflowData, isLoading: cashflowLoading } = useQuery({
    queryKey: ['bi-cashflow'],
    queryFn: () => api.biCashFlow(),
  });

  const { data: scenariosData, isLoading: scenariosLoading } = useQuery({
    queryKey: ['bi-scenarios'],
    queryFn: () => api.biScenarios(),
  });

  const cfoChatMutation = useMutation({
    mutationFn: (title: string) => api.biCfoChat(title),
    onSuccess: (response) => {
      const aiMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, aiMessage]);
    },
  });

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleSendMessage = () => {
    if (!chatInput.trim() || cfoChatMutation.isPending) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: chatInput.trim(),
      timestamp: new Date(),
    };

    setChatMessages(prev => [...prev, userMessage]);
    cfoChatMutation.mutate(chatInput.trim());
    setChatInput('');
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handlePromptClick = (prompt: string) => {
    setChatInput(prompt);
  };

  const subTabs: { id: SubTab; label: string; icon: React.ReactNode }[] = [
    { id: 'overview', label: 'Обзор', icon: <Activity size={16} /> },
    { id: 'aifinance', label: 'AI CFO', icon: <Brain size={16} /> },
    { id: 'scenarios', label: 'Сценарии', icon: <Target size={16} /> },
  ];

  const preBuiltPrompts = [
    { text: 'Дневной отчёт', icon: <MessageSquare size={14} /> },
    { text: 'Анализ MRR', icon: <TrendingUp size={14} /> },
    { text: 'Прогноз', icon: <Target size={14} /> },
    { text: 'Unit Economics', icon: <DollarSign size={14} /> },
  ];

  const dashboard = dashboardData?.data;
  const mrr = mrrData?.data;
  const churn = churnData?.data;
  const ltv = ltvData?.data;
  const cac = cacData?.data;
  const unitEconomics = unitEconomicsData?.data;
  const cashflow = cashflowData?.data;
  const scenarios = scenariosData?.data;

  const kpiCards = [
    {
      title: 'MRR',
      value: formatCurrency(dashboard?.mrr?.current || 0),
      change: dashboard?.mrr?.growth || 0,
      icon: <DollarSign size={20} />,
      color: 'text-emerald-400',
    },
    {
      title: 'ARR',
      value: formatCurrency((dashboard?.mrr?.current || 0) * 12),
      change: dashboard?.mrr?.growth || 0,
      icon: <TrendingUp size={20} />,
      color: 'text-blue-400',
    },
    {
      title: 'Churn Rate',
      value: formatPercentage(dashboard?.churn?.rate || 0),
      change: -(dashboard?.churn?.trend || 0),
      icon: <Users size={20} />,
      color: 'text-rose-400',
    },
    {
      title: 'LTV',
      value: formatCurrency(dashboard?.ltv?.average || 0),
      change: dashboard?.ltv?.growth || 0,
      icon: <Zap size={20} />,
      color: 'text-purple-400',
    },
    {
      title: 'CAC',
      value: formatCurrency(dashboard?.cac?.average || 0),
      change: -(dashboard?.cac?.trend || 0),
      icon: <Target size={20} />,
      color: 'text-amber-400',
    },
    {
      title: 'Unit Economics',
      value: `${(dashboard?.unitEconomics?.ratio || 0).toFixed(1)}x`,
      change: dashboard?.unitEconomics?.trend || 0,
      icon: <PieChart size={20} />,
      color: 'text-cyan-400',
    },
  ];

  if (dashboardLoading) {
    return (
      <div className="space-y-6 max-w-full overflow-x-hidden">
        <Skeleton className="h-12 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-80" />
          <Skeleton className="h-80" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-full overflow-x-hidden">
      <PageHeader
        title="Business Intelligence"
        subtitle="Платформенная аналитика и AI CFO"
        icon={<BarChart3 className="text-dv-gold" size={24} />}
      />

      <div className="flex flex-wrap gap-2 p-1 bg-surface-2/50 rounded-xl w-full sm:w-fit">
        {subTabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeSubTab === tab.id
                ? 'bg-dv-gold text-dv-gold-on shadow-lg'
                : 'text-txt-muted hover:text-txt-primary hover:bg-surface-2'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeSubTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpiCards.map((kpi, index) => (
              <StatCard
                key={index}
                label={kpi.title}
                value={kpi.value}
                icon={kpi.icon}
              />
            ))}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <TrendingUp className="text-dv-gold" size={20} />
                  MRR Тренд
                </h3>
                {mrrLoading ? (
                  <Skeleton className="h-64" />
                ) : mrr?.trend?.length > 0 ? (
                  <LineChartComponent
                    data={mrr.trend}
                    xKey="date"
                    yKey="value"
                    height={250}
                    color="#10b981"
                  />
                ) : (
                  <EmptyState title="Нет данных для отображения" />
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-dv-gold" size={20} />
                  Выручка по доменам
                </h3>
                {cashflowLoading ? (
                  <Skeleton className="h-64" />
                ) : cashflow?.byDomain?.length > 0 ? (
                  <BarChartComponent
                    data={cashflow.byDomain}
                    xKey="domain"
                    yKey="revenue"
                    height={250}
                    color="#3b82f6"
                  />
                ) : (
                  <EmptyState title="Нет данных для отображения" />
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <PieChart className="text-dv-gold" size={20} />
                  Распределение подписок
                </h3>
                {mrrLoading ? (
                  <Skeleton className="h-64" />
                ) : mrr?.distribution?.length > 0 ? (
                  <DonutChartComponent
                    data={mrr.distribution.map((d: any) => ({ name: d.plan, value: d.count }))}
                    height={200}
                  />
                ) : (
                  <EmptyState title="Нет данных для отображения" />
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Activity className="text-dv-gold" size={20} />
                  Churn Analysis
                </h3>
                {churnLoading ? (
                  <Skeleton className="h-64" />
                ) : churn?.monthly?.length > 0 ? (
                  <AreaChartComponent
                    data={churn.monthly}
                    xKey="month"
                    yKey="rate"
                    height={200}
                    color="#ef4444"
                  />
                ) : (
                  <EmptyState title="Нет данных для отображения" />
                )}
              </CardContent>
            </Card>

            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Zap className="text-dv-gold" size={20} />
                  Unit Economics
                </h3>
                {unitEconomicsLoading ? (
                  <Skeleton className="h-64" />
                ) : unitEconomics ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-txt-muted">LTV</span>
                      <span className="text-lg font-semibold text-emerald-400">
                        {formatCurrency(unitEconomics.ltv || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-txt-muted">CAC</span>
                      <span className="text-lg font-semibold text-rose-400">
                        {formatCurrency(unitEconomics.cac || 0)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-txt-muted">LTV/CAC</span>
                      <span className="text-lg font-semibold text-dv-gold">
                        {(unitEconomics.ratio || 0).toFixed(2)}x
                      </span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-txt-muted">Payback Period</span>
                      <span className="text-lg font-semibold text-amber-400">
                        {unitEconomics.paybackMonths || 0} мес
                      </span>
                    </div>
                  </div>
                ) : (
                  <EmptyState title="Нет данных для отображения" />
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {activeSubTab === 'aifinance' && (
        <div className="flex flex-col h-[calc(100vh-300px)]">
          <Card className="bg-surface-2/50 border-bdr-subtle flex-1 flex flex-col">
            <CardContent className="p-6 flex-1 flex flex-col">
              <div className="flex items-center gap-2 mb-4 pb-4 border-b border-bdr-subtle">
                <Brain className="text-dv-gold" size={20} />
                <h3 className="text-lg font-semibold">AI CFO Assistant</h3>
                <Badge variant="default" className="ml-auto">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 mr-2 animate-pulse" />
                  Online
                </Badge>
              </div>

              <div className="flex gap-2 mb-4 flex-wrap">
                {preBuiltPrompts.map((prompt, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    size="sm"
                    onClick={() => handlePromptClick(prompt.text)}
                    className="flex items-center gap-2"
                  >
                    {prompt.icon}
                    {prompt.text}
                  </Button>
                ))}
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 mb-4">
                {chatMessages.length === 0 ? (
                  <div className="flex-1 flex items-center justify-center h-full">
                    <div className="text-center text-txt-muted">
                      <Brain size={48} className="mx-auto mb-4 opacity-50" />
                      <p className="text-lg">Задайте вопрос вашему AI CFO</p>
                      <p className="text-sm mt-2">Используйте готовые запросы или введите свой вопрос</p>
                    </div>
                  </div>
                ) : (
                  chatMessages.map((title) => (
                    <div
                      key={title.id}
                      className={`flex ${title.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          title.role === 'user'
                            ? 'bg-dv-gold/20 text-txt-primary'
                            : 'bg-surface-2 border border-bdr-subtle text-txt-primary'
                        }`}
                      >
                        {title.role === 'assistant' && (
                          <div className="flex items-center gap-2 mb-2 text-xs text-txt-muted">
                            <Brain size={12} />
                            AI CFO
                          </div>
                        )}
                        <p className="whitespace-pre-wrap">{title.content}</p>
                        <div className={`text-xs mt-2 ${title.role === 'user' ? 'text-right' : 'text-left'} text-txt-muted`}>
                          {title.timestamp.toLocaleTimeString('ru-RU', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex flex-wrap gap-2 pt-4 border-t border-bdr-subtle">
                <Input
                  placeholder="Задайте вопрос о финансах..."
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  disabled={cfoChatMutation.isPending}
                  className="flex-1 min-h-11"
                />
                <Button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim()}
                  loading={cfoChatMutation.isPending}
                  size="icon"
                  className="min-h-11 min-w-11"
                >
                  <Send size={16} />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeSubTab === 'scenarios' && (
        <div className="space-y-6">
          <Card className="bg-surface-2/50 border-bdr-subtle">
            <CardContent className="p-6">
              <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                <Target className="text-dv-gold" size={20} />
                Финансовые сценарии
              </h3>

              {scenariosLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-64" />
                  ))}
                </div>
              ) : scenarios ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                        <TrendingUp className="text-emerald-400" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-emerald-400">Оптимистичный</h4>
                        <p className="text-xs text-txt-muted">Лучший сценарий</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-txt-muted">MRR (12 мес)</span>
                        <span className="font-semibold text-emerald-400">
                          {formatCurrency(scenarios.optimistic?.mrr12 || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Рост</span>
                        <span className="font-semibold text-emerald-400">
                          +{formatPercentage(scenarios.optimistic?.growth || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Клиенты</span>
                        <span className="font-semibold text-emerald-400">
                          {scenarios.optimistic?.clients || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Churn</span>
                        <span className="font-semibold text-emerald-400">
                          {formatPercentage(scenarios.optimistic?.churn || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-blue-500/30 bg-blue-500/5 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Activity className="text-blue-400" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-blue-400">Базовый</h4>
                        <p className="text-xs text-txt-muted">Реалистичный сценарий</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-txt-muted">MRR (12 мес)</span>
                        <span className="font-semibold text-blue-400">
                          {formatCurrency(scenarios.base?.mrr12 || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Рост</span>
                        <span className="font-semibold text-blue-400">
                          +{formatPercentage(scenarios.base?.growth || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Клиенты</span>
                        <span className="font-semibold text-blue-400">
                          {scenarios.base?.clients || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Churn</span>
                        <span className="font-semibold text-blue-400">
                          {formatPercentage(scenarios.base?.churn || 0)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-lg bg-rose-500/20 flex items-center justify-center">
                        <TrendingDown className="text-rose-400" size={20} />
                      </div>
                      <div>
                        <h4 className="font-semibold text-rose-400">Пессимистичный</h4>
                        <p className="text-xs text-txt-muted">Худший сценарий</p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-txt-muted">MRR (12 мес)</span>
                        <span className="font-semibold text-rose-400">
                          {formatCurrency(scenarios.pessimistic?.mrr12 || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Рост</span>
                        <span className="font-semibold text-rose-400">
                          +{formatPercentage(scenarios.pessimistic?.growth || 0)}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Клиенты</span>
                        <span className="font-semibold text-rose-400">
                          {scenarios.pessimistic?.clients || 0}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-txt-muted">Churn</span>
                        <span className="font-semibold text-rose-400">
                          {formatPercentage(scenarios.pessimistic?.churn || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <EmptyState title="Нет данных о сценариях" />
              )}
            </CardContent>
          </Card>

          {scenarios?.chart?.length > 0 && (
            <Card className="bg-surface-2/50 border-bdr-subtle">
              <CardContent className="p-6">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="text-dv-gold" size={20} />
                  Прогноз по сценариям
                </h3>
                <BarChartComponent
                  data={scenarios.chart}
                  xKey="month"
                  yKey="value"
                  height={300}
                  color="#C9A96E"
                />
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}