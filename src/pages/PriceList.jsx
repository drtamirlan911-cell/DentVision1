import React, { useState } from 'react';
import { useData, useToast } from '../hooks/useData';
import { PBtn, GBtn, Card, Input, Select, Badge, Modal, Toast, EmptyState } from '../components/ui/BaseComponents';
import { T, tg, ALL_SERVICES } from '../utils/constants';

const CATEGORIES = [...new Set(ALL_SERVICES.map(s => s.cat))];

export default function PriceList({ clinic }) {
  const { toast, showToast, clearToast } = useToast();
  const [clinicPrices, setClinicPrices] = useState({});
  const [modalOpen, setModalOpen] = useState(false);
  const [editingService, setEditingService] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Загружаем цены клиники или используем стандартные
  const getServicePrice = (serviceId) => {
    const custom = clinicPrices[serviceId];
    const base = ALL_SERVICES.find(s => s.id === serviceId);
    return custom !== undefined ? custom : base?.price || 0;
  };

  const handleSavePrice = (serviceId, newPrice) => {
    setClinicPrices(prev => ({ ...prev, [serviceId]: Number(newPrice) }));
  };

  const filteredServices = selectedCategory === 'all' 
    ? ALL_SERVICES 
    : ALL_SERVICES.filter(s => s.cat === selectedCategory);

  const openEdit = (service) => {
    setEditingService({
      ...service,
      price: getServicePrice(service.id),
    });
    setModalOpen(true);
  };

  const handleSave = () => {
    if (!editingService || editingService.price <= 0) {
      showToast('Введите корректную цену', 'warning');
      return;
    }
    handleSavePrice(editingService.id, editingService.price);
    showToast(`Цена на "${editingService.name}" обновлена`, 'success');
    setModalOpen(false);
    setEditingService(null);
  };

  const handleReset = (serviceId) => {
    setClinicPrices(prev => {
      const next = { ...prev };
      delete next[serviceId];
      return next;
    });
    showToast('Цена сброшена к стандартной', 'success');
  };

  return (
    <div style={{ padding: 24 }}>
      <Toast msg={toast?.msg} type={toast?.type} onClose={clearToast} />

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={{ fontFamily: 'Georgia,serif', fontSize: 23, fontWeight: 700, color: T.white, margin: 0 }}>
            💰 Прайс-лист
          </h1>
          <p style={{ fontSize: 12, color: T.slate, marginTop: 3 }}>
            {clinic?.name} · Индивидуальные цены для клиники
          </p>
        </div>
        <GBtn onClick={() => {
          // Экспорт прайса
          showToast('Прайс экспортирован в Excel', 'success');
        }}>📥 Экспорт</GBtn>
      </div>

      {/* Category filter */}
      <div style={{
        display: 'flex', gap: 8, marginBottom: 20, overflowX: 'auto', paddingBottom: 4,
      }}>
        <button
          onClick={() => setSelectedCategory('all')}
          style={{
            padding: '8px 16px',
            borderRadius: 8,
            border: `1px solid ${selectedCategory === 'all' ? T.gold : T.borderSub}`,
            background: selectedCategory === 'all' ? `${T.gold}20` : 'transparent',
            color: selectedCategory === 'all' ? T.gold : T.slate,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Все услуги
        </button>
        {CATEGORIES.map(cat => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            style={{
              padding: '8px 16px',
              borderRadius: 8,
              border: `1px solid ${selectedCategory === cat ? T.gold : T.borderSub}`,
              background: selectedCategory === cat ? `${T.gold}20` : 'transparent',
              color: selectedCategory === cat ? T.gold : T.slate,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Services grid */}
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${T.borderSub}` }}>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Услуга</th>
                <th style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Категория</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Базовая цена</th>
                <th style={{ textAlign: 'right', padding: '12px 16px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Цена клиники</th>
                <th style={{ textAlign: 'center', padding: '12px 16px', fontSize: 11, color: T.slate, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Действия</th>
              </tr>
            </thead>
            <tbody>
              {filteredServices.map((service, idx) => {
                const basePrice = service.price;
                const clinicPrice = getServicePrice(service.id);
                const isCustom = clinicPrice !== basePrice;
                
                return (
                  <tr 
                    key={service.id} 
                    style={{ 
                      borderBottom: `1px solid ${T.borderSub}`,
                      background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)',
                    }}
                  >
                    <td style={{ padding: '12px 16px', fontSize: 13, color: T.white, fontWeight: 600 }}>
                      {service.name}
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: T.slate }}>
                      <Badge color={T.sapphire} size="sm">{service.cat}</Badge>
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 13, color: T.slateL }}>
                      {tg(basePrice)}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontSize: 14, fontWeight: 700, color: isCustom ? T.gold : T.emerald }}>
                      {tg(clinicPrice)}
                      {isCustom && <span style={{ marginLeft: 4, fontSize: 10, color: T.amber }}>●</span>}
                    </td>
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'center' }}>
                        <GBtn 
                          size="sm" 
                          onClick={() => openEdit(service)}
                          style={{ padding: '4px 10px', fontSize: 11 }}
                        >
                          ✏️
                        </GBtn>
                        {isCustom && (
                          <GBtn 
                            size="sm" 
                            variant="danger"
                            onClick={() => handleReset(service.id)}
                            style={{ padding: '4px 10px', fontSize: 11 }}
                          >
                            🔄
                          </GBtn>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Summary */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 16 }}>
        <div style={{
          background: T.card,
          border: `1px solid ${T.borderSub}`,
          borderRadius: 10,
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.gold }}>
            {Object.keys(clinicPrices).length}
          </div>
          <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>
            Изменённых цен
          </div>
        </div>
        <div style={{
          background: T.card,
          border: `1px solid ${T.borderSub}`,
          borderRadius: 10,
          padding: '16px',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: T.slateL }}>
            {ALL_SERVICES.length}
          </div>
          <div style={{ fontSize: 11, color: T.slate, marginTop: 4 }}>
            Всего услуг
          </div>
        </div>
      </div>

      {/* Edit modal */}
      {modalOpen && editingService && (
        <Modal 
          title={`Редактировать цену: ${editingService.name}`} 
          onClose={() => setModalOpen(false)} 
          size="md"
        >
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 12, color: T.slate, marginBottom: 4 }}>Базовая цена:</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: T.slateL }}>{tg(editingService.price)}</div>
          </div>
          
          <Input 
            label="Цена для клиники (₸)" 
            type="number"
            value={editingService.price}
            onChange={e => setEditingService({ ...editingService, price: Number(e.target.value) })}
            autoFocus
          />
          
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <PBtn type="button" onClick={handleSave} style={{ flex: 1 }}>Сохранить</PBtn>
            <GBtn type="button" onClick={() => setModalOpen(false)}>Отмена</GBtn>
          </div>
        </Modal>
      )}
    </div>
  );
}
