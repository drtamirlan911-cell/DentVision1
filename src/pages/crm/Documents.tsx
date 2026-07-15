import React, { useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, Plus, Search, Edit3, Save, X, Trash2, Download, Eye, Copy, Stethoscope, Shield, ClipboardList, PenTool, Send, Link2 } from 'lucide-react';
import SignaturePad from '../../components/ui/SignaturePad';
import { gid, today } from '../../utils/constants';
import { useData, useToast } from '../../hooks/useData';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/ds/Card';
import { Button } from '../../components/ui/ds/Button';
import { Badge } from '../../components/ui/ds/Badge';
import { Input, Textarea, Select } from '../../components/ui/ds/Input';
import { Modal } from '../../components/ui/ds/Modal';
import { EmptyState } from '../../components/ui/ds/EmptyState';
import { PageHeader } from '../../components/ui/ds/StatCard';
import type { Document, Patient, User as UserType, Clinic, RoleInfo } from '../../types';

const DOC_STATUS: Record<string, { l: string; v: string }> = {
  draft: { l: '╨з╨╡╤А╨╜╨╛╨▓╨╕╨║', v: 'slate' },
  active: { l: '╨Ф╨╡╨╣╤Б╤В╨▓╤Г╤О╤Й╨╕╨╣', v: 'emerald' },
  pending_signature: { l: '╨Ю╨╢╨╕╨┤╨░╨╡╤В ╨┐╨╛╨┤╨┐╨╕╤Б╨╕', v: 'gold' },
  signed: { l: '╨Я╨╛╨┤╨┐╨╕╤Б╨░╨╜', v: 'gold' },
  archived: { l: '╨Р╤А╤Е╨╕╨▓', v: 'sapphire' },
};

const DOC_TEMPLATES = [
  {
    category: '╨б╨╛╨│╨╗╨░╤Б╨╕╤П',
    items: [
      {
        type: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╗╨╡╤З╨╡╨╜╨╕╨╡',
        title: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╛╨║╨░╨╖╨░╨╜╨╕╨╡ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╤Г╤Б╨╗╤Г╨│',
        content: `╨б╨Ю╨У╨Ы╨Р╨б╨Ш╨Х ╨Э╨Р ╨Ю╨Ъ╨Р╨Ч╨Р╨Э╨Ш╨Х ╨б╨в╨Ю╨Ь╨Р╨в╨Ю╨Ы╨Ю╨У╨Ш╨з╨Х╨б╨Ъ╨Ш╨е ╨Ь╨Х╨Ф╨Ш╨ж╨Ш╨Э╨б╨Ъ╨Ш╨е ╨г╨б╨Ы╨г╨У

╨п, _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░),
╨┤╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________, ╨┐╨░╤Б╨┐╨╛╤А╤В: _________________

╨Э╨░╤Б╤В╨╛╤П╤Й╨╕╨╝ ╨┤╨░╤О ╤Б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╛╨║╨░╨╖╨░╨╜╨╕╨╡ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╨╝╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╕╤Е ╤Г╤Б╨╗╤Г╨│ ╨▓ ╨║╨╗╨╕╨╜╨╕╨║╨╡ ┬л{clinic_name}┬╗.

1. ╨п ╨╕╨╜╤Д╨╛╤А╨╝╨╕╤А╨╛╨▓╨░╨╜(╨░) ╨╛ ╨┤╨╕╨░╨│╨╜╨╛╨╖╨╡: _________________________________
2. ╨Я╨╗╨░╨╜ ╨╗╨╡╤З╨╡╨╜╨╕╤П: _______________________________________________
3. ╨Ь╨╜╨╡ ╤А╨░╨╖╤К╤П╤Б╨╜╨╡╨╜╤Л:
   - ╨е╨░╤А╨░╨║╤В╨╡╤А ╨╖╨░╨▒╨╛╨╗╨╡╨▓╨░╨╜╨╕╤П ╨╕ ╨┐╤А╨╡╨┤╨┐╨╛╨╗╨░╨│╨░╨╡╨╝╤Л╨╡ ╨╝╨╡╤В╨╛╨┤╤Л ╨╗╨╡╤З╨╡╨╜╨╕╤П
   - ╨Т╨╛╨╖╨╝╨╛╨╢╨╜╤Л╨╡ ╨░╨╗╤М╤В╨╡╤А╨╜╨░╤В╨╕╨▓╨╜╤Л╨╡ ╨╝╨╡╤В╨╛╨┤╤Л ╨╗╨╡╤З╨╡╨╜╨╕╤П
   - ╨а╨╕╤Б╨║╨╕ ╨╕ ╨▓╨╛╨╖╨╝╨╛╨╢╨╜╤Л╨╡ ╨╛╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╤П
   - ╨Я╤А╨╡╨┤╨┐╨╛╨╗╨░╨│╨░╨╡╨╝╤Л╨╣ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В ╨╗╨╡╤З╨╡╨╜╨╕╤П
   - ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╤Г╤Б╨╗╤Г╨│: _____________ ╤В╨╡╨╜╨│╨╡

4. ╨п ╨┤╨░╤О ╤Б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░:
   [ ] ╨Ы╨╡╤З╨╡╨╜╨╕╨╡ ╨║╨░╤А╨╕╨╡╤Б╨░ ╨╕ ╨╡╨│╨╛ ╨╛╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╨╣
   [ ] ╨н╨╜╨┤╨╛╨┤╨╛╨╜╤В╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╗╨╡╤З╨╡╨╜╨╕╨╡ (╨┐╨╗╨╛╨╝╨▒╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡ ╨║╨░╨╜╨░╨╗╨╛╨▓)
   [ ] ╨е╨╕╤А╤Г╤А╨│╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨▓╨╝╨╡╤И╨░╤В╨╡╨╗╤М╤Б╤В╨▓╨╛ (╤Г╨┤╨░╨╗╨╡╨╜╨╕╨╡ ╨╖╤Г╨▒╨╛╨▓)
   [ ] ╨Я╤А╨╛╤В╨╡╨╖╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡ (╤Г╤Б╤В╨░╨╜╨╛╨▓╨║╨░ ╨║╨╛╤А╨╛╨╜╨╛╨║, ╨╝╨╛╤Б╤В╨╛╨▓, ╨┐╤А╨╛╤В╨╡╨╖╨╛╨▓)
   [ ] ╨Ш╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤О
   [ ] ╨Ю╤А╤В╨╛╨┤╨╛╨╜╤В╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╗╨╡╤З╨╡╨╜╨╕╨╡
   [ ] ╨Я╤А╨╛╤Д╨╡╤Б╤Б╨╕╨╛╨╜╨░╨╗╤М╨╜╤Г╤О ╨│╨╕╨│╨╕╨╡╨╜╤Г ╨┐╨╛╨╗╨╛╤Б╤В╨╕ ╤А╤В╨░
   [ ] ╨а╨╡╨╜╤В╨│╨╡╨╜╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╕╤Б╤Б╨╗╨╡╨┤╨╛╨▓╨░╨╜╨╕╨╡
   [ ] ╨Р╨╜╨╡╤Б╤В╨╡╨╖╨╕╤О (╨╛╨▒╨╡╨╖╨▒╨╛╨╗╨╕╨▓╨░╨╜╨╕╨╡)
   [ ] ╨Ш╨╜╨╛╨╡: _________________________________

5. ╨п ╨┐╤А╨╡╨┤╤Г╨┐╤А╨╡╨╢╨┤╤С╨╜(╨░) ╨╛ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╤Б╤В╨╕ ╤Б╨╛╨▒╨╗╤О╨┤╨╡╨╜╨╕╤П ╤А╨╡╨║╨╛╨╝╨╡╨╜╨┤╨░╤Ж╨╕╨╣ ╨▓╤А╨░╤З╨░
6. ╨п ╨┐╨╛╨┤╤В╨▓╨╡╤А╨╢╨┤╨░╤О, ╤З╤В╨╛ ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╕╨╗(╨░) ╨┤╨╛╤Б╤В╨╛╨▓╨╡╤А╨╜╤Л╨╡ ╤Б╨▓╨╡╨┤╨╡╨╜╨╕╤П ╨╛ ╤Б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╕ ╨╖╨┤╨╛╤А╨╛╨▓╤М╤П

╨Ф╨░╤В╨░: _________________                    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░: _________________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨▓╤А╨░╤З╨░: _________________`,
      },
      {
        type: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨░╨╜╨╡╤Б╤В╨╡╨╖╨╕╤О',
        title: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨┐╤А╨╛╨▓╨╡╨┤╨╡╨╜╨╕╨╡ ╨░╨╜╨╡╤Б╤В╨╡╨╖╨╕╨╕',
        content: `╨б╨Ю╨У╨Ы╨Р╨б╨Ш╨Х ╨Э╨Р ╨Я╨а╨Ю╨Т╨Х╨Ф╨Х╨Э╨Ш╨Х ╨Р╨Э╨Х╨б╨в╨Х╨Ч╨Ш╨Ш (╨Ю╨С╨Х╨Ч╨С╨Ю╨Ы╨Ш╨Т╨Р╨Э╨Ш╨п)

╨п, _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░),
╨┤╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________

╨Ш╨╜╤Д╨╛╤А╨╝╨╕╤А╨╛╨▓╨░╨╜(╨░) ╨╛ ╤В╨╛╨╝, ╤З╤В╨╛ ╨▓ ╨┐╤А╨╛╤Ж╨╡╤Б╤Б╨╡ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨│╨╛ ╨╗╨╡╤З╨╡╨╜╨╕╤П ╨▒╤Г╨┤╨╡╤В ╨┐╤А╨╛╨▓╨╡╨┤╨╡╨╜╨╛ ╨╛╨▒╨╡╨╖╨▒╨╛╨╗╨╕╨▓╨░╨╜╨╕╨╡.

╨Ь╨╜╨╡ ╤А╨░╨╖╤К╤П╤Б╨╜╨╡╨╜╤Л:
1. ╨Т╨╕╨┤ ╨░╨╜╨╡╤Б╤В╨╡╨╖╨╕╨╕: _________________________________
   (╨╕╨╜╤Д╨╕╨╗╤М╤В╤А╨░╤Ж╨╕╨╛╨╜╨╜╨░╤П / ╨┐╤А╨╛╨▓╨╛╨┤╨╜╨╕╨║╨╛╨▓╨░╤П / ╨░╨┐╨┐╨╗╨╕╨║╨░╤Ж╨╕╨╛╨╜╨╜╨░╤П / ╤Б╨╡╨┤╨░╤Ж╨╕╤П)
2. ╨Я╤А╨╡╨┐╨░╤А╨░╤В ╨┤╨╗╤П ╨░╨╜╨╡╤Б╤В╨╡╨╖╨╕╨╕: _________________________________
3. ╨Т╨╛╨╖╨╝╨╛╨╢╨╜╤Л╨╡ ╨┐╨╛╨▒╨╛╤З╨╜╤Л╨╡ ╤А╨╡╨░╨║╤Ж╨╕╨╕:
   - ╨Р╨╗╨╗╨╡╤А╨│╨╕╤З╨╡╤Б╨║╨░╤П ╤А╨╡╨░╨║╤Ж╨╕╤П ╨╜╨░ ╨░╨╜╨╡╤Б╤В╨╡╤В╨╕╨║
   - ╨Я╨╛╨▓╤А╨╡╨╢╨┤╨╡╨╜╨╕╨╡ ╨╜╨╡╤А╨▓╨░ (╨║╤А╨░╤В╨║╨╛╨▓╤А╨╡╨╝╨╡╨╜╨╜╨╛╨╡ ╨╛╨╜╨╡╨╝╨╡╨╜╨╕╨╡)
   - ╨У╨╡╨╝╨░╤В╨╛╨╝╨░ ╨▓ ╨╝╨╡╤Б╤В╨╡ ╨╕╨╜╤К╨╡╨║╤Ж╨╕╨╕
   - ╨Ъ╤А╨░╤В╨║╨╛╨▓╤А╨╡╨╝╨╡╨╜╨╜╨░╤П ╤В╨░╤Е╨╕╨║╨░╤А╨┤╨╕╤П
   - ╨У╨╛╨╗╨╛╨▓╨╛╨║╤А╤Г╨╢╨╡╨╜╨╕╨╡, ╤В╨╛╤И╨╜╨╛╤В╨░
4. ╨Т╨╡╤А╨╛╤П╤В╨╜╨╛╤Б╤В╤М ╤Б╨╡╤А╤М╤С╨╖╨╜╤Л╤Е ╨╛╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╨╣ ╤Б╨╛╤Б╤В╨░╨▓╨╗╤П╨╡╤В ╨╝╨╡╨╜╨╡╨╡ 1:500 000

╨п ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╕╨╗(╨░) ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛╨▒ ╨░╨╗╨╗╨╡╤А╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╤А╨╡╨░╨║╤Ж╨╕╤П╤Е:
[ ] ╨Э╨╡╤В ╨░╨╗╨╗╨╡╤А╨│╨╕╨╕
[ ] ╨Р╨╗╨╗╨╡╤А╨│╨╕╤П ╨╜╨░: _________________________________
[ ] ╨Э╨╡╨┐╨╡╤А╨╡╨╜╨╛╤Б╨╕╨╝╨╛╤Б╤В╤М: _________________________________

╨Ф╨░╤В╨░: _________________                    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░: _________________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨▓╤А╨░╤З╨░: _________________`,
      },
      {
        type: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╤Е╨╕╤А╤Г╤А╨│╨╕╤О',
        title: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╤Е╨╕╤А╤Г╤А╨│╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨▓╨╝╨╡╤И╨░╤В╨╡╨╗╤М╤Б╤В╨▓╨╛',
        content: `╨б╨Ю╨У╨Ы╨Р╨б╨Ш╨Х ╨Э╨Р ╨е╨Ш╨а╨г╨а╨У╨Ш╨з╨Х╨б╨Ъ╨Ю╨Х ╨Т╨Ь╨Х╨и╨Р╨в╨Х╨Ы╨м╨б╨в╨Т╨Ю

╨п, _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░),
╨┤╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________

╨Я╤А╨╛╨╕╨╜╤Д╨╛╤А╨╝╨╕╤А╨╛╨▓╨░╨╜(╨░) ╤Е╨╕╤А╤Г╤А╨│╨╛╨╝-╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╛╨╝ _________________________________ ╨╛ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╤Б╤В╨╕ ╨┐╤А╨╛╨▓╨╡╨┤╨╡╨╜╨╕╤П ╤Е╨╕╤А╤Г╤А╨│╨╕╤З╨╡╤Б╨║╨╛╨│╨╛ ╨▓╨╝╨╡╤И╨░╤В╨╡╨╗╤М╤Б╤В╨▓╨░:

╨Ф╨╕╨░╨│╨╜╨╛╨╖: _________________________________
╨Я╨╛╨║╨░╨╖╨░╨╜╨╕╨╡ ╨║ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕: _________________________________
╨Т╨╕╨┤ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕: _________________________________
╨Я╤А╨╡╨┤╨┐╨╛╨╗╨░╨│╨░╨╡╨╝╨░╤П ╨┐╤А╨╛╨┤╨╛╨╗╨╢╨╕╤В╨╡╨╗╤М╨╜╨╛╤Б╤В╤М: _______ ╨╝╨╕╨╜ / ╤З╨░╤Б

╨Ь╨╜╨╡ ╤А╨░╨╖╤К╤П╤Б╨╜╨╡╨╜╤Л:
1. ╨ж╨╡╨╗╤М ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕ ╨╕ ╨╛╨╢╨╕╨┤╨░╨╡╨╝╤Л╨╣ ╤А╨╡╨╖╤Г╨╗╤М╤В╨░╤В
2. ╨Ь╨╡╤В╨╛╨┤ ╨┐╤А╨╛╨▓╨╡╨┤╨╡╨╜╨╕╤П ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕
3. ╨Э╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╤Б╤В╤М ╨┐╤А╨╡╨┤╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╛╨╜╨╜╨╛╨╣ ╨┐╨╛╨┤╨│╨╛╤В╨╛╨▓╨║╨╕ (╨░╨╜╨░╨╗╨╕╨╖╤Л, ╤А╨╡╨╜╤В╨│╨╡╨╜)
4. ╨Т╨╕╨┤ ╨░╨╜╨╡╤Б╤В╨╡╨╖╨╕╨╕: _________________________________
5. ╨а╨╕╤Б╨║╨╕ ╨╕ ╨▓╨╛╨╖╨╝╨╛╨╢╨╜╤Л╨╡ ╨╛╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╤П:
   - ╨Ъ╤А╨╛╨▓╨╛╤В╨╡╤З╨╡╨╜╨╕╨╡
   - ╨Ш╨╜╤Д╨╕╤Ж╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡
   - ╨Я╨╛╨▓╤А╨╡╨╢╨┤╨╡╨╜╨╕╨╡ ╤Б╨╛╤Б╨╡╨┤╨╜╨╕╤Е ╤В╨║╨░╨╜╨╡╨╣/╨╖╤Г╨▒╨╛╨▓
   - ╨Ю╨╜╨╡╨╝╨╡╨╜╨╕╨╡ (╨┐╨░╤А╨╡╤Б╤В╨╡╨╖╨╕╤П)
   - ╨Ю╤Б╨╗╨╛╨╢╨╜╨╡╨╜╨╕╤П ╨╖╨░╨╢╨╕╨▓╨╗╨╡╨╜╨╕╤П
   - ╨Ю╤В╤С╨║, ╨▒╨╛╨╗╨╡╨▓╨╛╨╣ ╤Б╨╕╨╜╨┤╤А╨╛╨╝ ╨┐╨╛╤Б╨╗╨╡ ╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╕
6. ╨Я╨╡╤А╨╕╨╛╨┤ ╨▓╨╛╤Б╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╕╤П: _______ ╨┤╨╜╨╡╨╣
7. ╨Р╨╗╤М╤В╨╡╤А╨╜╨░╤В╨╕╨▓╨╜╤Л╨╡ ╨╝╨╡╤В╨╛╨┤╤Л ╨╗╨╡╤З╨╡╨╜╨╕╤П: _________________________________

╨Я╤А╨╡╨┤╨╛╨┐╨╡╤А╨░╤Ж╨╕╨╛╨╜╨╜╤Л╨╡ ╨░╨╜╨░╨╗╨╕╨╖╤Л ╤Б╨┤╨░╨╜╤Л: [ ] ╨Ф╨░ [ ] ╨Э╨╡╤В
╨а╨╡╨╜╤В╨│╨╡╨╜╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╕╤Б╤Б╨╗╨╡╨┤╨╛╨▓╨░╨╜╨╕╨╡ ╨▓╤Л╨┐╨╛╨╗╨╜╨╡╨╜╨╛: [ ] ╨Ф╨░ [ ] ╨Э╨╡╤В

╨Ф╨░╤В╨░: _________________                    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░: _________________

╨е╨╕╤А╤Г╤А╨│: _________________________________   ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨▓╤А╨░╤З╨░: _________________`,
      },
      {
        type: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╨╕╨╝╨┐╨╗╨░╨╜╤В╨░╤Ж╨╕╤О',
        title: '╨б╨╛╨│╨╗╨░╤Б╨╕╨╡ ╨╜╨░ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨║╤Г ╨┤╨╡╨╜╤В╨░╨╗╤М╨╜╤Л╤Е ╨╕╨╝╨┐╨╗╨░╨╜╤В╨╛╨▓',
        content: `╨б╨Ю╨У╨Ы╨Р╨б╨Ш╨Х ╨Э╨Р ╨г╨б╨в╨Р╨Э╨Ю╨Т╨Ъ╨г ╨Ф╨Х╨Э╨в╨Р╨Ы╨м╨Э╨л╨е ╨Ш╨Ь╨Я╨Ы╨Р╨Э╨в╨Ю╨Т

╨п, _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░),
╨┐╤А╨╛╨╕╨╜╤Д╨╛╤А╨╝╨╕╤А╨╛╨▓╨░╨╜(╨░) ╨╛ ╨╜╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╤Б╤В╨╕ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨║╨╕ ╨┤╨╡╨╜╤В╨░╨╗╤М╨╜╤Л╤Е ╨╕╨╝╨┐╨╗╨░╨╜╤В╨╛╨▓.

╨Ю╨▒╨╗╨░╤Б╤В╤М ╤Г╤Б╤В╨░╨╜╨╛╨▓╨║╨╕: _________________________________
╨Ъ╨╛╨╗╨╕╤З╨╡╤Б╤В╨▓╨╛ ╨╕╨╝╨┐╨╗╨░╨╜╤В╨╛╨▓: _______
╨б╨╕╤Б╤В╨╡╨╝╨░ ╨╕╨╝╨┐╨╗╨░╨╜╤В╨╛╨▓: _________________________________

╨Ь╨╜╨╡ ╤А╨░╨╖╤К╤П╤Б╨╜╨╡╨╜╤Л:
1. ╨н╤В╨░╨┐╨╜╨╛╤Б╤В╤М ╨╗╨╡╤З╨╡╨╜╨╕╤П: ╤Е╨╕╤А╤Г╤А╨│╨╕╤З╨╡╤Б╨║╨╕╨╣ ╤Н╤В╨░╨┐ тЖТ ╨┐╨╡╤А╨╕╨╛╨┤ ╨╛╤Б╤В╨╡╨╛╨╕╨╜╤В╨╡╨│╤А╨░╤Ж╨╕╨╕ (3-6 ╨╝╨╡╤Б) тЖТ ╨╛╤А╤В╨╛╨┐╨╡╨┤╨╕╤З╨╡╤Б╨║╨╕╨╣ ╤Н╤В╨░╨┐
2. ╨Э╨╡╨╛╨▒╤Е╨╛╨┤╨╕╨╝╨╛╤Б╤В╤М ╨┤╨╛╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╤Е ╨┐╤А╨╛╤Ж╨╡╨┤╤Г╤А: ╨╜╨░╤А╨░╤Й╨╕╨▓╨░╨╜╨╕╨╡ ╨║╨╛╤Б╤В╨╕ (╨░╤Г╨│╨╝╨╡╨╜╤В╨░╤Ж╨╕╤П), ╤Б╨╕╨╜╤Г╤Б-╨╗╨╕╤Д╤В╨╕╨╜╨│
3. ╨а╨╕╤Б╨║╨╕: ╨╛╤В╤В╨╛╤А╨╢╨╡╨╜╨╕╨╡ ╨╕╨╝╨┐╨╗╨░╨╜╤В╨░ (3-5%), ╨╕╨╜╤Д╨╕╤Ж╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡, ╨┐╨╛╨▓╤А╨╡╨╢╨┤╨╡╨╜╨╕╨╡ ╨╜╨╡╤А╨▓╨╛╨▓, ╤Б╨╕╨╜╤Г╤Б╨╕╤В╨░
4. ╨б╤А╨╛╨║ ╤Б╨╗╤Г╨╢╨▒╤Л ╨╕╨╝╨┐╨╗╨░╨╜╤В╨░ ╨╖╨░╨▓╨╕╤Б╨╕╤В ╨╛╤В ╨│╨╕╨│╨╕╨╡╨╜╤Л ╨╕ ╤А╨╡╨│╤Г╨╗╤П╤А╨╜╤Л╤Е ╨╛╤Б╨╝╨╛╤В╤А╨╛╨▓
5. ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М: ╨╕╨╝╨┐╨╗╨░╨╜╤В _____________ ╤В╨╡╨╜╨│╨╡, ╨║╨╛╤А╨╛╨╜╨║╨░ _____________ ╤В╨╡╨╜╨│╨╡
6. ╨У╨░╤А╨░╨╜╤В╨╕╤П ╨╜╨░ ╨╕╨╝╨┐╨╗╨░╨╜╤В: _______ ╨╗╨╡╤В ╨┐╤А╨╕ ╤А╨╡╨│╤Г╨╗╤П╤А╨╜╤Л╤Е ╨╛╤Б╨╝╨╛╤В╤А╨░╤Е (1 ╤А╨░╨╖ ╨▓ 6 ╨╝╨╡╤Б)

╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М ╨▓╤Б╨╡╨│╨╛ ╨╗╨╡╤З╨╡╨╜╨╕╤П: _____________ ╤В╨╡╨╜╨│╨╡

╨Ф╨░╤В╨░: _________________                    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░: _________________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨▓╤А╨░╤З╨░: _________________`,
      },
    ],
  },
  {
    category: '╨Ь╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╕╨╡ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╤Л',
    items: [
      {
        type: '╨Ь╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╛╨╡ ╨╖╨░╨║╨╗╤О╤З╨╡╨╜╨╕╨╡',
        title: '╨Ь╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╛╨╡ ╨╖╨░╨║╨╗╤О╤З╨╡╨╜╨╕╨╡ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨░',
        content: `╨Ь╨Х╨Ф╨Ш╨ж╨Ш╨Э╨б╨Ъ╨Ю╨Х ╨Ч╨Р╨Ъ╨Ы╨о╨з╨Х╨Э╨Ш╨Х

╨Ф╨░╤В╨░: _________________
╨Ъ╨╗╨╕╨╜╨╕╨║╨░: ┬л{clinic_name}┬╗

╨Я╨░╤Ж╨╕╨╡╨╜╤В: _________________________________
╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________

╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч:
╨Ю╤Б╨╜╨╛╨▓╨╜╨╛╨╣: _________________________________ (╨Ь╨Ъ╨С-10: _______)
╨б╨╛╨┐╤Г╤В╤Б╤В╨▓╤Г╤О╤Й╨╕╨╡: _________________________________

╨а╨Х╨Ч╨г╨Ы╨м╨в╨Р╨в╨л ╨Ю╨б╨Ь╨Ю╨в╨а╨Р:
╨б╨╛╤Б╤В╨╛╤П╨╜╨╕╨╡ ╨┐╨╛╨╗╨╛╤Б╤В╨╕ ╤А╤В╨░: _________________________________
╨Ч╤Г╨▒╨╜╨░╤П ╤Д╨╛╤А╨╝╤Г╨╗╨░: [ ] ╨б╤Д╨╛╤А╨╝╨╕╤А╨╛╨▓╨░╨╜╨░ [ ] ╨з╨░╤Б╤В╨╕╤З╨╜╨░╤П ╨░╨┤╨╡╨╜╤В╨╕╤П [ ] ╨Я╨╛╨╗╨╜╨░╤П ╨░╨┤╨╡╨╜╤В╨╕╤П
╨У╨╕╨│╨╕╨╡╨╜╨░ ╨┐╨╛╨╗╨╛╤Б╤В╨╕ ╤А╤В╨░: [ ] ╨г╨┤╨╛╨▓╨╗╨╡╤В╨▓╨╛╤А╨╕╤В╨╡╨╗╤М╨╜╨░╤П [ ] ╨Э╨╡╤Г╨┤╨╛╨▓╨╗╨╡╤В╨▓╨╛╤А╨╕╤В╨╡╨╗╤М╨╜╨░╤П
╨Я╨░╤А╨╛╨┤╨╛╨╜╤В: [ ] ╨Т ╨╜╨╛╤А╨╝╨╡ [ ] ╨У╨╕╨╜╨│╨╕╨▓╨╕╤В [ ] ╨Я╨░╤А╨╛╨┤╨╛╨╜╤В╨╕╤В ╤Б╤В. ___

╨а╨Х╨Ч╨г╨Ы╨м╨в╨Р╨в╨л ╨Ф╨Ш╨Р╨У╨Э╨Ю╨б╨в╨Ш╨Ъ╨Ш:
╨а╨╡╨╜╤В╨│╨╡╨╜: _________________________________
╨Ъ╨в/╨Я╨░╨╜╨╛╤А╨░╨╝╨╜╤Л╨╣ ╤Б╨╜╨╕╨╝╨╛╨║: _________________________________

╨Я╨Ы╨Р╨Э ╨Ы╨Х╨з╨Х╨Э╨Ш╨п:
1. _________________________________
2. _________________________________
3. _________________________________

╨Я╨а╨Ю╨У╨Э╨Ю╨Ч: [ ] ╨С╨╗╨░╨│╨╛╨┐╤А╨╕╤П╤В╨╜╤Л╨╣ [ ] ╨Ю╤Б╤В╨╛╤А╨╛╨╢╨╜╤Л╨╣ [ ] ╨б╨╛╨╝╨╜╨╕╤В╨╡╨╗╤М╨╜╤Л╨╣

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨Ы╨╕╤Ж╨╡╨╜╨╖╨╕╤П тДЦ: _________________`,
      },
      {
        type: '╨н╨┐╨╕╨║╤А╨╕╨╖',
        title: '╨Т╤Л╨┐╨╕╤Б╨╜╨╛╨╣ ╤Н╨┐╨╕╨║╤А╨╕╨╖',
        content: `╨Т╨л╨Я╨Ш╨б╨Э╨Ю╨Щ ╨н╨Я╨Ш╨Ъ╨а╨Ш╨Ч

╨Я╨░╤Ж╨╕╨╡╨╜╤В: _________________________________
╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________
╨Я╨╡╤А╨╕╨╛╨┤ ╨╗╨╡╤З╨╡╨╜╨╕╤П: ╤Б _____________ ╨┐╨╛ _____________

╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч ╨Я╨а╨Ш ╨Я╨Ю╨б╨в╨г╨Я╨Ы╨Х╨Э╨Ш╨Ш:
_______________________________

╨Я╨а╨Ю╨Т╨Х╨Ф╨Б╨Э╨Э╨Ю╨Х ╨Ы╨Х╨з╨Х╨Э╨Ш╨Х:
1. _________________________________
2. _________________________________
3. _________________________________

╨а╨Х╨Ч╨г╨Ы╨м╨в╨Р╨в ╨Ы╨Х╨з╨Х╨Э╨Ш╨п:
[ ] ╨Т╤Л╨╖╨┤╨╛╤А╨╛╨▓╨╗╨╡╨╜╨╕╨╡  [ ] ╨г╨╗╤Г╤З╤И╨╡╨╜╨╕╨╡  [ ] ╨С╨╡╨╖ ╨╕╨╖╨╝╨╡╨╜╨╡╨╜╨╕╨╣

╨а╨Х╨Ъ╨Ю╨Ь╨Х╨Э╨Ф╨Р╨ж╨Ш╨Ш:
1. _________________________________
2. _________________________________
3. _________________________________

╨б╨а╨Ю╨Ъ ╨Т╨а╨Х╨Ь╨Х╨Э╨Э╨Ю╨Щ ╨Э╨Х╨в╨а╨г╨Ф╨Ю╨б╨Я╨Ю╨б╨Ю╨С╨Э╨Ю╨б╨в╨Ш: _______ ╨┤╨╜╨╡╨╣
╨б╨Ы╨Х╨Ф╨г╨о╨й╨Ш╨Щ ╨Ю╨б╨Ь╨Ю╨в╨а: _____________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________`,
      },
      {
        type: '╨а╨╡╤Ж╨╡╨┐╤В',
        title: '╨а╨╡╤Ж╨╡╨┐╤В ╨╜╨░ ╨╗╨╡╨║╨░╤А╤Б╤В╨▓╨╡╨╜╨╜╨╛╨╡ ╤Б╤А╨╡╨┤╤Б╤В╨▓╨╛',
        content: `╨а╨Х╨ж╨Х╨Я╨в

╨Ф╨░╤В╨░: _________________

╨Я╨░╤Ж╨╕╨╡╨╜╤В: _________________________________
╨Т╨╛╨╖╤А╨░╤Б╤В: _________________

Rp.:
1. _________________________________
   ╨б╨┐╨╛╤Б╨╛╨▒ ╨┐╤А╨╕╨╝╨╡╨╜╨╡╨╜╨╕╤П: _________________________________
   ╨Ф╨╛╨╖╨╕╤А╨╛╨▓╨║╨░: _________________________________
   ╨Ъ╤А╨░╤В╨╜╨╛╤Б╤В╤М: _______ ╤А╨░╨╖(╨░) ╨▓ ╨┤╨╡╨╜╤М
   ╨Ъ╤Г╤А╤Б: _______ ╨┤╨╜╨╡╨╣

2. _________________________________
   ╨б╨┐╨╛╤Б╨╛╨▒ ╨┐╤А╨╕╨╝╨╡╨╜╨╡╨╜╨╕╤П: _________________________________
   ╨Ф╨╛╨╖╨╕╤А╨╛╨▓╨║╨░: _________________________________
   ╨Ъ╤А╨░╤В╨╜╨╛╤Б╤В╤М: _______ ╤А╨░╨╖(╨░) ╨▓ ╨┤╨╡╨╜╤М
   ╨Ъ╤Г╤А╤Б: _______ ╨┤╨╜╨╡╨╣

╨Ю╤Б╨╛╨▒╤Л╨╡ ╤Г╨║╨░╨╖╨░╨╜╨╕╤П: _________________________________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨Я╨╡╤З╨░╤В╤М: _________________`,
      },
      {
        type: '╨Э╨░╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡',
        title: '╨Э╨░╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╨╡ ╨║ ╤Б╨┐╨╡╤Ж╨╕╨░╨╗╨╕╤Б╤В╤Г',
        content: `╨Э╨Р╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨Х ╨Ъ ╨б╨Я╨Х╨ж╨Ш╨Р╨Ы╨Ш╨б╨в╨г

╨Ф╨░╤В╨░: _________________
╨Ш╨╖ ╨║╨╗╨╕╨╜╨╕╨║╨╕: ┬л{clinic_name}┬╗

╨Я╨░╤Ж╨╕╨╡╨╜╤В: _________________________________
╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________
╨в╨╡╨╗╨╡╤Д╨╛╨╜: _________________

╨Ф╨Ш╨Р╨У╨Э╨Ю╨Ч: _________________________________
(╨Ь╨Ъ╨С-10: _______)

╨Э╨Р╨Я╨а╨Р╨Т╨Ы╨п╨Х╨в╨б╨п ╨Ъ:
╨Т╤А╨░╤З: _________________________________
╨б╨┐╨╡╤Ж╨╕╨░╨╗╤М╨╜╨╛╤Б╤В╤М: _________________________________
╨Ъ╨╗╨╕╨╜╨╕╨║╨░/╤Г╤З╤А╨╡╨╢╨┤╨╡╨╜╨╕╨╡: _________________________________

╨ж╨Х╨Ы╨м ╨Э╨Р╨Я╨а╨Р╨Т╨Ы╨Х╨Э╨Ш╨п:
_______________________________
_______________________________

╨б╨а╨Ю╨з╨Э╨Ю╨б╨в╨м: [ ] ╨н╨║╤Б╤В╤А╨╡╨╜╨╜╨╛ [ ] ╨Т ╨┐╨╗╨░╨╜╨╛╨▓╨╛╨╝ ╨┐╨╛╤А╤П╨┤╨║╨╡

╨б╨Ю╨Я╨а╨Ю╨Т╨Ю╨Ф╨Ш╨в╨Х╨Ы╨м╨Э╨л╨Х ╨Ф╨Ю╨Ъ╨г╨Ь╨Х╨Э╨в╨л:
[ ] ╨а╨╡╨╜╤В╨│╨╡╨╜╨╛╨▓╤Б╨║╨╕╨╡ ╤Б╨╜╨╕╨╝╨║╨╕
[ ] ╨Т╤Л╨┐╨╕╤Б╨║╨░ ╨╕╨╖ ╨╝╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╛╨╣ ╨║╨░╤А╤В╤Л
[ ] ╨а╨╡╨╖╤Г╨╗╤М╤В╨░╤В╤Л ╨░╨╜╨░╨╗╨╕╨╖╨╛╨▓
[ ] ╨Ш╨╜╨╛╨╡: _________________________________

╨Т╤А╨░╤З: _________________________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨Я╨╡╤З╨░╤В╤М: _________________`,
      },
    ],
  },
  {
    category: '╨Ф╨╛╨│╨╛╨▓╨╛╤А╤Л',
    items: [
      {
        type: '╨Ф╨╛╨│╨╛╨▓╨╛╤А ╨╜╨░ ╨╗╨╡╤З╨╡╨╜╨╕╨╡',
        title: '╨Ф╨╛╨│╨╛╨▓╨╛╤А ╨╜╨░ ╨╛╨║╨░╨╖╨░╨╜╨╕╨╡ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╤Г╤Б╨╗╤Г╨│',
        content: `╨Ф╨Ю╨У╨Ю╨Т╨Ю╨а ╨Э╨Р ╨Ю╨Ъ╨Р╨Ч╨Р╨Э╨Ш╨Х ╨б╨в╨Ю╨Ь╨Р╨в╨Ю╨Ы╨Ю╨У╨Ш╨з╨Х╨б╨Ъ╨Ш╨е ╨г╨б╨Ы╨г╨У тДЦ _____________

╨│. _____________                         _____________ 20___ ╨│.

┬л{clinic_name}┬╗ (╨┤╨░╨╗╨╡╨╡ тАФ ╨Ш╤Б╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М), ╨▓ ╨╗╨╕╤Ж╨╡ ╨┤╨╕╤А╨╡╨║╤В╨╛╤А╨░ _________________________________,
╤Б ╨╛╨┤╨╜╨╛╨╣ ╤Б╤В╨╛╤А╨╛╨╜╤Л, ╨╕

_______________________________ (╨┤╨░╨╗╨╡╨╡ тАФ ╨Я╨░╤Ж╨╕╨╡╨╜╤В/╨Ч╨░╨║╨░╨╖╤З╨╕╨║), ╨┐╨░╤Б╨┐╨╛╤А╤В ╤Б╨╡╤А╨╕╤П _______ тДЦ _____________,
╨▓╤Л╨┤╨░╨╜ _____________, ╨┤╨░╤В╨░ ╨▓╤Л╨┤╨░╤З╨╕ _____________,
╤Б ╨┤╤А╤Г╨│╨╛╨╣ ╤Б╤В╨╛╤А╨╛╨╜╤Л, ╨╖╨░╨║╨╗╤О╤З╨╕╨╗╨╕ ╨╜╨░╤Б╤В╨╛╤П╤Й╨╕╨╣ ╨┤╨╛╨│╨╛╨▓╨╛╤А ╨╛ ╨╜╨╕╨╢╨╡╤Б╨╗╨╡╨┤╤Г╤О╤Й╨╡╨╝:

1. ╨Я╨а╨Х╨Ф╨Ь╨Х╨в ╨Ф╨Ю╨У╨Ю╨Т╨Ю╨а╨Р
   1.1. ╨Ш╤Б╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М ╨╛╨▒╤П╨╖╤Г╨╡╤В╤Б╤П ╨╛╨║╨░╨╖╨░╤В╤М ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╨╡ ╨╝╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╕╨╡ ╤Г╤Б╨╗╤Г╨│╨╕,
        ╨░ ╨Я╨░╤Ж╨╕╨╡╨╜╤В тАФ ╨┐╤А╨╕╨╜╤П╤В╤М ╨╕ ╨╛╨┐╨╗╨░╤В╨╕╤В╤М ╤Г╨║╨░╨╖╨░╨╜╨╜╤Л╨╡ ╤Г╤Б╨╗╤Г╨│╨╕.

2. ╨Я╨Х╨а╨Х╨з╨Х╨Э╨м ╨г╨б╨Ы╨г╨У ╨Ш ╨б╨в╨Ю╨Ш╨Ь╨Ю╨б╨в╨м
   тДЦ  |  ╨Э╨░╨╕╨╝╨╡╨╜╨╛╨▓╨░╨╜╨╕╨╡ ╤Г╤Б╨╗╤Г╨│╨╕                          |  ╨б╤В╨╛╨╕╨╝╨╛╤Б╤В╤М (тВ╕)
   1.  |  ________________________________________   |  _____________
   2.  |  ________________________________________   |  _____________
   3.  |  ________________________________________   |  _____________
                                                   ╨Ш╨в╨Ю╨У╨Ю: _____________

3. ╨Я╨Ю╨а╨п╨Ф╨Ю╨Ъ ╨Ю╨Я╨Ы╨Р╨в╨л
   3.1. ╨Ю╨┐╨╗╨░╤В╨░ ╨┐╤А╨╛╨╕╨╖╨▓╨╛╨┤╨╕╤В╤Б╤П: [ ] ╨Э╨░╨╗╨╕╤З╨╜╤Л╨╝╨╕ [ ] ╨С╨░╨╜╨║╨╛╨▓╤Б╨║╨░╤П ╨║╨░╤А╤В╨░ [ ] ╨Я╨╡╤А╨╡╨▓╨╛╨┤
   3.2. ╨Я╤А╨╡╨┤╨╛╨┐╨╗╨░╤В╨░: _____________ %
   3.3. ╨Ю╨║╨╛╨╜╤З╨░╤В╨╡╨╗╤М╨╜╤Л╨╣ ╤А╨░╤Б╤З╤С╤В тАФ ╨┐╨╛╤Б╨╗╨╡ ╨╖╨░╨▓╨╡╤А╤И╨╡╨╜╨╕╤П ╨╛╨║╨░╨╖╨░╨╜╨╕╤П ╤Г╤Б╨╗╤Г╨│.

4. ╨б╨а╨Ю╨Ъ╨Ш ╨Т╨л╨Я╨Ю╨Ы╨Э╨Х╨Э╨Ш╨п
   4.1. ╨г╤Б╨╗╤Г╨│╨╕ ╨╛╨║╨░╨╖╤Л╨▓╨░╤О╤В╤Б╤П ╨▓ ╤Б╤А╨╛╨║╨╕, ╤Б╨╛╨│╨╗╨░╤Б╨╛╨▓╨░╨╜╨╜╤Л╨╡ ╨▓ ╨┐╨╗╨░╨╜╨╡ ╨╗╨╡╤З╨╡╨╜╨╕╤П.

5. ╨Ю╨С╨п╨Ч╨Р╨Э╨Э╨Ю╨б╨в╨Ш ╨б╨в╨Ю╨а╨Ю╨Э
   5.1. ╨Ш╤Б╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М ╨╛╨▒╤П╨╖╤Г╨╡╤В╤Б╤П ╨╛╨║╨░╨╖╨░╤В╤М ╤Г╤Б╨╗╤Г╨│╨╕ ╨╜╨░╨┤╨╗╨╡╨╢╨░╤Й╨╡╨│╨╛ ╨║╨░╤З╨╡╤Б╤В╨▓╨░.
   5.2. ╨Я╨░╤Ж╨╕╨╡╨╜╤В ╨╛╨▒╤П╨╖╤Г╨╡╤В╤Б╤П ╨┐╤А╨╡╨┤╨╛╤Б╤В╨░╨▓╨╕╤В╤М ╨┤╨╛╤Б╤В╨╛╨▓╨╡╤А╨╜╤Г╤О ╨╕╨╜╤Д╨╛╤А╨╝╨░╤Ж╨╕╤О ╨╛ ╨╖╨┤╨╛╤А╨╛╨▓╤М╨╡.

6. ╨У╨Р╨а╨Р╨Э╨в╨Ш╨Ш
   6.1. ╨У╨░╤А╨░╨╜╤В╨╕╨╣╨╜╤Л╨╣ ╤Б╤А╨╛╨║ ╨╜╨░ ╨┐╤А╨╛╤В╨╡╨╖╤Л ╨╕ ╨║╨╛╤А╨╛╨╜╨║╨╕: 12 ╨╝╨╡╤Б╤П╤Ж╨╡╨▓.

7. ╨Ю╨в╨Т╨Х╨в╨б╨в╨Т╨Х╨Э╨Э╨Ю╨б╨в╨м
   7.1. ╨б╤В╨╛╤А╨╛╨╜╤Л ╨╜╨╡╤Б╤Г╤В ╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╡╨╜╨╜╨╛╤Б╤В╤М ╨▓ ╤Б╨╛╨╛╤В╨▓╨╡╤В╤Б╤В╨▓╨╕╨╕ ╤Б ╨╖╨░╨║╨╛╨╜╨╛╨┤╨░╤В╨╡╨╗╤М╤Б╤В╨▓╨╛╨╝ ╨а╨Ъ.

╨Я╨Ю╨Ф╨Я╨Ш╨б╨Ш ╨б╨в╨Ю╨а╨Ю╨Э:

╨Ш╤Б╨┐╨╛╨╗╨╜╨╕╤В╨╡╨╗╤М: _________________    ╨Я╨░╤Ж╨╕╨╡╨╜╤В: _________________
╨Я╨╡╤З╨░╤В╤М: _________________`,
      },
    ],
  },
  {
    category: '╨б╨┐╤А╨░╨▓╨║╨╕',
    items: [
      {
        type: '╨б╨┐╤А╨░╨▓╨║╨░ ╨╛ ╨╗╨╡╤З╨╡╨╜╨╕╨╕',
        title: '╨б╨┐╤А╨░╨▓╨║╨░ ╨╛ ╨┐╤А╨╛╤Е╨╛╨╢╨┤╨╡╨╜╨╕╨╕ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨│╨╛ ╨╗╨╡╤З╨╡╨╜╨╕╤П',
        content: `╨б╨Я╨а╨Р╨Т╨Ъ╨Р

╨Т╤Л╨┤╨░╨╜╨░ _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░)
╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________

╨Т ╤В╨╛╨╝, ╤З╤В╨╛ ╨╛╨╜(╨░) ╨┐╤А╨╛╤Е╨╛╨┤╨╕╨╗(╨░) ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨╡ ╨╗╨╡╤З╨╡╨╜╨╕╨╡ ╨▓ ╨║╨╗╨╕╨╜╨╕╨║╨╡ ┬л{clinic_name}┬╗
╤Б _____________ ╨┐╨╛ _____________

╨Ф╨╕╨░╨│╨╜╨╛╨╖: _________________________________

╨Я╤А╨╛╨▓╨╡╨┤╤С╨╜╨╜╨╛╨╡ ╨╗╨╡╤З╨╡╨╜╨╕╨╡:
_______________________________
_______________________________

╨б╨┐╤А╨░╨▓╨║╨░ ╨▓╤Л╨┤╨░╨╜╨░ ╨┤╨╗╤П ╨┐╤А╨╡╨┤╤К╤П╨▓╨╗╨╡╨╜╨╕╤П ╨┐╨╛ ╨╝╨╡╤Б╤В╤Г ╤В╤А╨╡╨▒╨╛╨▓╨░╨╜╨╕╤П.

╨Ф╨░╤В╨░ ╨▓╤Л╨┤╨░╤З╨╕: _________________

╨Ы╨╡╤З╨░╤Й╨╕╨╣ ╨▓╤А╨░╤З: _________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨У╨╗╨░╨▓╨╜╤Л╨╣ ╨▓╤А╨░╤З: _________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨Я╨╡╤З╨░╤В╤М ╨║╨╗╨╕╨╜╨╕╨║╨╕: _________________`,
      },
      {
        type: '╨б╨┐╤А╨░╨▓╨║╨░ ╨╛╨▒ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╨╕ ╨┐╤А╨╛╤В╨╕╨▓╨╛╨┐╨╛╨║╨░╨╖╨░╨╜╨╕╨╣',
        title: '╨б╨┐╤А╨░╨▓╨║╨░ ╨╛╨▒ ╨╛╤В╤Б╤Г╤В╤Б╤В╨▓╨╕╨╕ ╨┐╤А╨╛╤В╨╕╨▓╨╛╨┐╨╛╨║╨░╨╖╨░╨╜╨╕╨╣ ╨║ ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╛╨╝╤Г ╨╗╨╡╤З╨╡╨╜╨╕╤О',
        content: `╨б╨Я╨а╨Р╨Т╨Ъ╨Р ╨Ю╨С ╨Ю╨в╨б╨г╨в╨б╨в╨Т╨Ш╨Ш ╨Я╨а╨Ю╨в╨Ш╨Т╨Ю╨Я╨Ю╨Ъ╨Р╨Ч╨Р╨Э╨Ш╨Щ

╨Т╤Л╨┤╨░╨╜╨░ _________________________________ (╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░)
╨Ф╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________

╨Э╨░ ╨╛╤Б╨╜╨╛╨▓╨░╨╜╨╕╨╕ ╨┐╤А╨╛╨▓╨╡╨┤╤С╨╜╨╜╨╛╨│╨╛ ╨╛╤Б╨╝╨╛╤В╤А╨░ ╨╕ ╤Б╨╛╨▒╤А╨░╨╜╨╜╨╛╨│╨╛ ╨░╨╜╨░╨╝╨╜╨╡╨╖╨░ ╤Г╤Б╤В╨░╨╜╨╛╨▓╨╗╨╡╨╜╨╛, ╤З╤В╨╛
╨┐╤А╨╛╤В╨╕╨▓╨╛╨┐╨╛╨║╨░╨╖╨░╨╜╨╕╨╣ ╨║ ╨┐╤А╨╛╨▓╨╡╨┤╨╡╨╜╨╕╤О ╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│╨╕╤З╨╡╤Б╨║╨╕╤Е ╨╝╨░╨╜╨╕╨┐╤Г╨╗╤П╤Ж╨╕╨╣ ╨Э╨Х╨в.

╨Ш╨╝╨╡╤О╤Й╨╕╨╡╤Б╤П ╤Е╤А╨╛╨╜╨╕╤З╨╡╤Б╨║╨╕╨╡ ╨╖╨░╨▒╨╛╨╗╨╡╨▓╨░╨╜╨╕╤П (╨┐╤А╨╕ ╨╜╨░╨╗╨╕╤З╨╕╨╕):
_______________________________

╨б╤А╨╛╨║ ╨┤╨╡╨╣╤Б╤В╨▓╨╕╤П ╤Б╨┐╤А╨░╨▓╨║╨╕: 30 ╨┤╨╜╨╡╨╣ ╤Б ╨╝╨╛╨╝╨╡╨╜╤В╨░ ╨▓╤Л╨┤╨░╤З╨╕.

╨Ф╨░╤В╨░: _________________

╨Т╤А╨░╤З-╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│: _________________    ╨Я╨╛╨┤╨┐╨╕╤Б╤М: _________________
╨Я╨╡╤З╨░╤В╤М: _________________`,
      },
    ],
  },
];

interface DocForm {
  patient_id: string
  doctor_id: string
  doc_type: string
  title: string
  content: string
  status: string
}

interface TemplateItem {
  type: string
  title: string
  content: string
}

interface OutletContext {
  clinic: Clinic & { id: string; name: string }
  user: UserType
  roleInfo?: RoleInfo
}

function getAllTemplates(): TemplateItem[] {
  return DOC_TEMPLATES.flatMap(cat => cat.items);
}

function TemplateCard({ template, onSelect }: { template: TemplateItem; onSelect: (t: TemplateItem) => void }) {
  return (
    <button
      onClick={() => onSelect(template)}
      className="rounded-xl border border-bdr-subtle bg-surface-raised p-3 text-left transition-all hover:border-dv-gold/30 hover:bg-surface-raised-hover"
    >
      <p className="text-xs font-bold text-txt-primary truncate">{template.title}</p>
      <p className="text-[10px] text-txt-muted mt-0.5">{template.type}</p>
    </button>
  );
}

export default function Documents() {
  const { clinic, user } = useOutletContext<OutletContext>();
  const { patients, doctors, documents, upsertDocument, deleteDocument } = useData(clinic?.id);
  const toast = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [previewDoc, setPreviewDoc] = useState<Document | null>(null);
  const [filterType, setFilterType] = useState('all');
  const [contentSnapshot, setContentSnapshot] = useState('');
  const [form, setForm] = useState<DocForm>({
    patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft',
  });

  const allTypes = useMemo(() => {
    const types = new Set<string>((documents || []).map(d => d.doc_type).filter(Boolean) as string[]);
    DOC_TEMPLATES.forEach(cat => cat.items.forEach(t => types.add(t.type)));
    return ['all', ...Array.from(types).sort()];
  }, [documents]);

  const filteredDocs = useMemo(() => {
    if (!documents) return [];
    let result = documents;
    if (filterType !== 'all') result = result.filter(d => d.doc_type === filterType);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(d =>
        d.title?.toLowerCase().includes(q) ||
        d.patient_name?.toLowerCase().includes(q) ||
        d.doc_type?.toLowerCase().includes(q) ||
        d.content?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [documents, searchQuery, filterType]);

  const resetForm = () => {
    setForm({ patient_id: '', doctor_id: '', doc_type: '', title: '', content: '', status: 'draft' });
    setContentSnapshot('');
    setEditingId(null);
    setShowForm(false);
    setShowTemplates(false);
  };

  const autoFillContent = (content: string, patientId: string, doctorId: string): string => {
    if (!content) return content;
    let filled = content;
    const patient = patients.find(p => p.id === patientId);
    const doctor = doctors.find(d => d.id === doctorId);
    const clinicName = clinic?.name || '╨Ъ╨╗╨╕╨╜╨╕╨║╨░';
    filled = filled.replace(/{clinic_name}/g, clinicName);
    if (patient) {
      const pName = patient.name || '';
      filled = filled.replace(/_{15,}\s*\(╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░\)/g, pName.padEnd(35, ' '));
      filled = filled.replace(/_{10,}\s*\(╨д╨Ш╨Ю\)/g, pName.padEnd(25, ' '));
      if (patient.dob) filled = filled.replace(/╨┤╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: _________________/g, `╨┤╨░╤В╨░ ╤А╨╛╨╢╨┤╨╡╨╜╨╕╤П: ${patient.dob}`);
      if (patient.phone) filled = filled.replace(/╨в╨╡╨╗╨╡╤Д╨╛╨╜: _________________/g, `╨в╨╡╨╗╨╡╤Д╨╛╨╜: ${patient.phone}`);
      if (patient.passport) filled = filled.replace(/╨┐╨░╤Б╨┐╨╛╤А╤В: _________________/g, `╨┐╨░╤Б╨┐╨╛╤А╤В: ${patient.passport}`);
      if (patient.address) filled = filled.replace(/╨Р╨┤╤А╨╡╤Б: _________________/g, `╨Р╨┤╤А╨╡╤Б: ${patient.address}`);
    }
    if (doctor) {
      const dName = doctor.name || '';
      filled = filled.replace(/╨Т╤А╨░╤З: _________________/g, `╨Т╤А╨░╤З: ${dName.padEnd(30, ' ')}`);
      filled = filled.replace(/╨е╨╕╤А╤Г╤А╨│: _________________/g, `╨е╨╕╤А╤Г╤А╨│: ${dName.padEnd(30, ' ')}`);
      filled = filled.replace(/╨Т╤А╨░╤З-╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│: _________________/g, `╨Т╤А╨░╤З-╤Б╤В╨╛╨╝╨░╤В╨╛╨╗╨╛╨│: ${dName.padEnd(20, ' ')}`);
      filled = filled.replace(/_{15,}\s*\(╨д╨Ш╨Ю ╨▓╤А╨░╤З╨░\)/g, dName.padEnd(35, ' '));
      if (doctor.spec) filled = filled.replace(/_{10,}\s*\(╤Б╨┐╨╡╤Ж╨╕╨░╨╗╤М╨╜╨╛╤Б╤В╤М\)/g, doctor.spec);
    }
    return filled;
  };

  const applyTemplate = (template: TemplateItem) => {
    const clinicName = clinic?.name || '╨Ъ╨╗╨╕╨╜╨╕╨║╨░';
    let content = template.content.replace(/{clinic_name}/g, clinicName);
    content = autoFillContent(content, form.patient_id, form.doctor_id);
    setContentSnapshot(content);
    setForm(f => ({ ...f, doc_type: template.type, title: template.title, content }));
    setShowTemplates(false);
    setShowForm(true);
  };

  const startEdit = (doc: Document) => {
    setForm({
      patient_id: doc.patient_id || doc.patientId || '',
      doctor_id: doc.doctor_id || '',
      doc_type: doc.doc_type || '',
      title: doc.title || '',
      content: doc.content || '',
      status: doc.status || 'draft',
    });
    setContentSnapshot(doc.content || '');
    setEditingId(doc.id);
    setShowForm(true);
  };

  const handlePatientChange = (patientId: string) => {
    setForm(f => {
      const newForm = { ...f, patient_id: patientId };
      if (contentSnapshot && f.content) {
        const reverted = f.content !== contentSnapshot ? contentSnapshot : f.content;
        const newContent = autoFillContent(reverted, patientId, f.doctor_id);
        setContentSnapshot(newContent);
        return { ...newForm, content: newContent };
      }
      return newForm;
    });
  };

  const handleDoctorChange = (doctorId: string) => {
    setForm(f => {
      const newForm = { ...f, doctor_id: doctorId };
      if (contentSnapshot && f.content) {
        const reverted = f.content !== contentSnapshot ? contentSnapshot : f.content;
        const newContent = autoFillContent(reverted, f.patient_id, doctorId);
        setContentSnapshot(newContent);
        return { ...newForm, content: newContent };
      }
      return newForm;
    });
  };

  const saveDocument = async () => {
    if (!form.title || !form.doc_type) { toast.error('╨Ч╨░╨┐╨╛╨╗╨╜╨╕╤В╨╡ ╤В╨╕╨┐ ╨╕ ╨╜╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨░'); return; }
    const patient = patients.find(p => p.id === form.patient_id);
    await upsertDocument({
      id: editingId || gid(),
      ...form,
      clinic_id: clinic.id,
      doctor_id: form.doctor_id || user?.id,
      patient_name: patient?.name || '',
      user_id: user?.id,
      user_name: user?.name,
    } as any);
    toast.success(editingId ? '╨Ф╨╛╨║╤Г╨╝╨╡╨╜╤В ╨╛╨▒╨╜╨╛╨▓╨╗╤С╨╜' : '╨Ф╨╛╨║╤Г╨╝╨╡╨╜╤В ╤Б╨╛╨╖╨┤╨░╨╜');
    resetForm();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('╨г╨┤╨░╨╗╨╕╤В╤М ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В?')) return;
    await deleteDocument(id);
    toast.success('╨Ф╨╛╨║╤Г╨╝╨╡╨╜╤В ╤Г╨┤╨░╨╗╤С╨╜');
  };

  const downloadDoc = (doc: Document) => {
    const blob = new Blob([doc.content || ''], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${doc.title || 'document'}.txt`;
    link.click();
  };

  const copyDoc = (content: string) => {
    navigator.clipboard.writeText(content || '').then(() => toast.success('╨б╨║╨╛╨┐╨╕╤А╨╛╨▓╨░╨╜╨╛ ╨▓ ╨▒╤Г╤Д╨╡╤А'));
  };

  const [signLink, setSignLink] = useState<string | null>(null);

  const handleSendForSignature = async (doc: Document) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')}/api/documents/${doc.id}/send-signature`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSignLink(data.signingUrl);
      toast.success('╨б╤Б╤Л╨╗╨║╨░ ╨┤╨╗╤П ╨┐╨╛╨┤╨┐╨╕╤Б╨╕ ╤Б╨╛╨╖╨┤╨░╨╜╨░');
    } catch {
      toast.error('╨Ю╤И╨╕╨▒╨║╨░ ╤Б╨╛╨╖╨┤╨░╨╜╨╕╤П ╤Б╤Б╤Л╨╗╨║╨╕');
    }
  };

  const [signInlineDoc, setSignInlineDoc] = useState<Document | null>(null);
  const [signInlineName, setSignInlineName] = useState('');

  const handleSignInline = async (doc: Document) => {
    if (!signInlineDoc || signInlineDoc.id !== doc.id) {
      setSignInlineDoc(doc);
      return;
    }
  };

  const handleInlineSignSave = async (signatureData: string) => {
    if (!signInlineName.trim()) { toast.warning('╨Т╨▓╨╡╨┤╨╕╤В╨╡ ╨╕╨╝╤П'); return; }
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || (window.location.hostname.includes('vercel.app') ? 'https://dentvision-api.onrender.com' : 'http://localhost:3001')}/api/documents/${signInlineDoc!.id}/sign`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signature_data: signatureData, signed_by_name: signInlineName }),
      });
      if (!res.ok) throw new Error();
      toast.success('╨Ф╨╛╨║╤Г╨╝╨╡╨╜╤В ╨┐╨╛╨┤╨┐╨╕╤Б╨░╨╜');
      setSignInlineDoc(null);
    } catch {
      toast.error('╨Ю╤И╨╕╨▒╨║╨░ ╨┐╨╛╨┤╨┐╨╕╤Б╨░╨╜╨╕╤П');
    }
  };

  return (
    <div className="fade-in space-y-6">
      <PageHeader
        title="╨н╨╗╨╡╨║╤В╤А╨╛╨╜╨╜╤Л╨╡ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╤Л"
        subtitle="╨б╨╛╨│╨╗╨░╤Б╨╕╤П, ╤А╨╡╤Ж╨╡╨┐╤В╤Л, ╨╜╨░╨┐╤А╨░╨▓╨╗╨╡╨╜╨╕╤П, ╨┤╨╛╨│╨╛╨▓╨╛╤А╤Л, ╤Б╨┐╤А╨░╨▓╨║╨╕, ╨╖╨░╨║╨╗╤О╤З╨╡╨╜╨╕╤П"
        icon={<FileText size={24} className="text-dv-gold" />}
        actions={
          <>
            <Button variant="outline" icon={<Copy size={16} />} onClick={() => { resetForm(); setShowTemplates(true); }}>
              ╨Ш╨╖ ╤И╨░╨▒╨╗╨╛╨╜╨░
            </Button>
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => { resetForm(); setShowForm(true); }}>
              ╨Т╤А╤Г╤З╨╜╤Г╤О
            </Button>
          </>
        }
      />

      {showTemplates && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Copy size={16} className="text-dv-gold" /> ╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡ ╤И╨░╨▒╨╗╨╛╨╜ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨░
                </span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={() => setShowTemplates(false)} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {DOC_TEMPLATES.map(cat => (
                  <div key={cat.category}>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-txt-muted mb-2 flex items-center gap-1.5">
                      {cat.category === '╨б╨╛╨│╨╗╨░╤Б╨╕╤П' && <Shield size={12} />}
                      {cat.category === '╨Ь╨╡╨┤╨╕╤Ж╨╕╨╜╤Б╨║╨╕╨╡ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╤Л' && <Stethoscope size={12} />}
                      {cat.category === '╨Ф╨╛╨│╨╛╨▓╨╛╤А╤Л' && <FileText size={12} />}
                      {cat.category === '╨б╨┐╤А╨░╨▓╨║╨╕' && <ClipboardList size={12} />}
                      {cat.category}
                    </h4>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {cat.items.map(t => (
                        <TemplateCard key={t.type} template={t} onSelect={applyTemplate} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {showForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>{editingId ? '╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╨╜╨╕╨╡' : '╨Э╨╛╨▓╤Л╨╣ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В'}</span>
                <Button variant="ghost" size="icon-sm" icon={<X size={18} />} onClick={resetForm} />
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨в╨╕╨┐ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨░ *</label>
                    <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}>
                      <option value="">╨Т╤Л╨▒╨╡╤А╨╕╤В╨╡...</option>
                      {DOC_TEMPLATES.map(cat => (
                        <optgroup key={cat.category} label={cat.category}>
                          {cat.items.map(t => <option key={t.type} value={t.type}>{t.type}</option>)}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Я╨░╤Ж╨╕╨╡╨╜╤В</label>
                    <select value={form.patient_id} onChange={e => handlePatientChange(e.target.value)}>
                      <option value="">╨Э╨╡ ╨▓╤Л╨▒╤А╨░╨╜</option>
                      {(patients || []).map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Т╤А╨░╤З</label>
                    <select value={form.doctor_id} onChange={e => handleDoctorChange(e.target.value)}>
                      <option value="">╨Э╨╡ ╨▓╤Л╨▒╤А╨░╨╜</option>
                      {(doctors || []).map(d => <option key={d.id} value={d.id}>{d.name}{d.spec ? ` (${d.spec})` : ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨б╤В╨░╤В╤Г╤Б</label>
                    <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                      {Object.entries(DOC_STATUS).map(([k, v]) => <option key={k} value={k}>{v.l}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ *</label>
                  <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="╨Э╨░╨╖╨▓╨░╨╜╨╕╨╡ ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨░..." />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold uppercase text-txt-muted">╨б╨╛╨┤╨╡╤А╨╢╨░╨╜╨╕╨╡</label>
                  <textarea rows={16} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="╨в╨╡╨║╤Б╤В ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨░..." className="font-mono text-xs leading-relaxed" />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="secondary" onClick={resetForm}>╨Ю╤В╨╝╨╡╨╜╨░</Button>
                  <Button variant="primary" icon={<Save size={14} />} onClick={saveDocument}>
                    {editingId ? '╨Ю╨▒╨╜╨╛╨▓╨╕╤В╤М' : '╨б╨╛╨╖╨┤╨░╤В╤М'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
          <input placeholder="╨Я╨╛╨╕╤Б╨║ ╨┐╨╛ ╨╜╨░╨╖╨▓╨░╨╜╨╕╤О, ╨┐╨░╤Ж╨╕╨╡╨╜╤В╤Г, ╤Б╨╛╨┤╨╡╤А╨╢╨░╨╜╨╕╤О..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9" />
        </div>
        <select value={filterType} onChange={e => setFilterType(e.target.value)} className="w-full md:w-56">
          {allTypes.map(t => (
            <option key={t} value={t}>{t === 'all' ? '╨Т╤Б╨╡ ╤В╨╕╨┐╤Л' : t}</option>
          ))}
        </select>
      </div>

      {previewDoc && (
        <Modal open={!!previewDoc} onClose={() => setPreviewDoc(null)}>
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-txt-primary">{previewDoc.title}</h3>
                <p className="text-xs text-txt-muted">{previewDoc.doc_type} ┬╖ {previewDoc.patient_name || '╨С╨╡╨╖ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░'}</p>
              </div>
              <Button variant="ghost" size="icon-sm" icon={<X size={20} />} onClick={() => setPreviewDoc(null)} />
            </div>
            <div className="whitespace-pre-wrap rounded-lg bg-white/5 p-6 text-sm text-txt-secondary font-mono leading-relaxed border border-bdr-subtle">
              {previewDoc.content || '╨Э╨╡╤В ╤Б╨╛╨┤╨╡╤А╨╢╨░╨╜╨╕╤П'}
            </div>
            {previewDoc.signature_data && (
              <div className="mt-4 rounded-lg border border-dv-gold/20 bg-dv-gold/5 p-4">
                <p className="mb-2 text-xs font-semibold text-dv-gold">╨н╨╗╨╡╨║╤В╤А╨╛╨╜╨╜╨░╤П ╨┐╨╛╨┤╨┐╨╕╤Б╤М</p>
                <img src={previewDoc.signature_data} alt="╨Я╨╛╨┤╨┐╨╕╤Б╤М" className="max-h-20 bg-white rounded-md p-1" />
                <p className="mt-2 text-xs text-txt-muted">
                  {previewDoc.signed_by_name && `╨Я╨╛╨┤╨┐╨╕╤Б╤М: ${previewDoc.signed_by_name}`}
                  {previewDoc.signed_at && ` ┬╖ ${new Date(previewDoc.signed_at).toLocaleString('ru-RU')}`}
                </p>
              </div>
            )}
            <div className="flex justify-end gap-2 mt-4">
              <Button variant="secondary" size="sm" icon={<Copy size={12} />} onClick={() => copyDoc(previewDoc.content || '')}>╨Ъ╨╛╨┐╨╕╤А╨╛╨▓╨░╤В╤М</Button>
              <Button variant="secondary" size="sm" icon={<Download size={12} />} onClick={() => downloadDoc(previewDoc)}>╨б╨║╨░╤З╨░╤В╤М</Button>
            </div>
          </div>
        </Modal>
      )}

      <div className="space-y-2">
        {filteredDocs.length === 0 ? (
          <EmptyState
            icon={<FileText size={48} />}
            title="╨Э╨╡╤В ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨╛╨▓"
            description="╨б╨╛╨╖╨┤╨░╨╣╤В╨╡ ╨╕╨╖ ╤И╨░╨▒╨╗╨╛╨╜╨░ ╨╕╨╗╨╕ ╨▓╤А╤Г╤З╨╜╤Г╤О"
          />
        ) : (
          filteredDocs.map((doc, i) => {
            const statusInfo = DOC_STATUS[doc.status || 'draft'] || DOC_STATUS.draft;
            return (
              <motion.div
                key={doc.id}
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.02 }}
              >
                <Card hover className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-dv-gold/10">
                        <FileText size={18} className="text-dv-gold" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-txt-primary">{doc.title}</h4>
                          <Badge variant={statusInfo.v as any} size="xs">{statusInfo.l}</Badge>
                        </div>
                        <p className="text-xs text-txt-muted mt-0.5">
                          {doc.doc_type} ┬╖ {doc.patient_name || '╨С╨╡╨╖ ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░'} ┬╖ {doc.created_at ? new Date(doc.created_at).toLocaleDateString('ru-RU') : 'тАФ'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon-xs" icon={<Eye size={14} />} onClick={() => setPreviewDoc(doc)} title="╨Я╤А╨╛╤Б╨╝╨╛╤В╤А" />
                      <Button variant="ghost" size="icon-xs" icon={<Copy size={14} />} onClick={() => copyDoc(doc.content || '')} title="╨Ъ╨╛╨┐╨╕╤А╨╛╨▓╨░╤В╤М" />
                      <Button variant="ghost" size="icon-xs" icon={<Download size={14} />} onClick={() => downloadDoc(doc)} title="╨б╨║╨░╤З╨░╤В╤М" />
                      <Button variant="ghost" size="icon-xs" icon={<Edit3 size={14} />} onClick={() => startEdit(doc)} title="╨а╨╡╨┤╨░╨║╤В╨╕╤А╨╛╨▓╨░╤В╤М" />
                      <Button variant="ghost" size="icon-xs" icon={<Trash2 size={14} />} onClick={() => handleDelete(doc.id)} title="╨г╨┤╨░╨╗╨╕╤В╤М" className="text-txt-muted hover:text-error" />
                      {doc.status !== 'signed' && (
                        <>
                          <Button variant="ghost" size="icon-xs" icon={<Send size={14} />} onClick={() => handleSendForSignature(doc)} title="╨Ю╤В╨┐╤А╨░╨▓╨╕╤В╤М ╨╜╨░ ╨┐╨╛╨┤╨┐╨╕╤Б╤М" />
                          <Button variant="ghost" size="icon-xs" icon={<PenTool size={14} />} onClick={() => handleSignInline(doc)} title="╨Я╨╛╨┤╨┐╨╕╤Б╨░╤В╤М ╨╜╨░ ╨┐╨╗╨░╨╜╤И╨╡╤В╨╡" className="text-txt-muted hover:text-emerald-400" />
                        </>
                      )}
                    </div>
                  </div>
                  {signLink && signInlineDoc?.id !== doc.id && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
                      <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-amber-400">
                        <Link2 size={12} /> ╨б╤Б╤Л╨╗╨║╨░ ╨┤╨╗╤П ╨┐╨╛╨┤╨┐╨╕╤Б╨╕
                      </div>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 truncate text-xs text-txt-secondary">{signLink}</code>
                        <Button variant="primary" size="xs" onClick={() => { navigator.clipboard.writeText(signLink); toast.success('╨б╨║╨╛╨┐╨╕╤А╨╛╨▓╨░╨╜╨╛'); }}>╨Ъ╨╛╨┐╨╕╤А╨╛╨▓╨░╤В╤М</Button>
                        <Button variant="ghost" size="icon-xs" icon={<X size={12} />} onClick={() => setSignLink(null)} />
                      </div>
                    </div>
                  )}
                  {signInlineDoc?.id === doc.id && (
                    <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
                      <p className="mb-2 text-xs font-semibold text-emerald-400">╨Я╨╛╨┤╨┐╨╕╤Б╤М ╨╜╨░ ╨┐╨╗╨░╨╜╤И╨╡╤В╨╡</p>
                      <input type="text" value={signInlineName} onChange={e => setSignInlineName(e.target.value)} placeholder="╨д╨Ш╨Ю ╨┐╨░╤Ж╨╕╨╡╨╜╤В╨░" className="mb-3 w-full" />
                      <div className="flex justify-center">
                        <SignaturePad onSave={handleInlineSignSave} width={Math.min(450, 380)} height={150} />
                      </div>
                      <button onClick={() => setSignInlineDoc(null)} className="mt-2 text-xs text-txt-muted hover:text-txt-primary">╨Ю╤В╨╝╨╡╨╜╨░</button>
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })
        )}
      </div>

      <div className="text-center text-xs text-txt-ghost">
        {filteredDocs.length} ╨┤╨╛╨║╤Г╨╝╨╡╨╜╤В╨╛╨▓ ┬╖ ╨и╨░╨▒╨╗╨╛╨╜╨╛╨▓: {getAllTemplates().length}
      </div>
    </div>
  );
}
