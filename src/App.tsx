import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import type { Shift, TimetableItem, ClassType } from './store/useAppStore';
import { auth } from './firebase';
import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  Trash2, 
  CheckSquare, 
  Square, 
  TrendingUp, 
  BookOpen, 
  Briefcase,
  LogOut,
  AlertCircle,
  GripVertical,
  MapPin,
  ExternalLink
} from 'lucide-react';

function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authConfirmPassword, setAuthConfirmPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

  // Tab State: 'school' | 'work'
  const [activeMainTab, setActiveMainTab] = useState<'school' | 'work'>('school');
  
  // School Sub-Tab: 'timetable' | 'assignments' | 'tests'
  const [schoolSubTab, setSchoolSubTab] = useState<'timetable' | 'assignments' | 'tests'>('timetable');
  const [isSchoolSyncEnabled, setIsSchoolSyncEnabled] = useState(false);
  const [isSchoolSyncPromptOpen, setIsSchoolSyncPromptOpen] = useState(false);
  const [syncPeriodKey, setSyncPeriodKey] = useState<'this-week' | 'next-week' | 'next-two-weeks' | 'this-month'>('this-week');
  const [isRegisteringToLifeOs, setIsRegisteringToLifeOs] = useState(false);
  const [isDeletingFromLifeOs, setIsDeletingFromLifeOs] = useState(false);
  const [defaultClassType, setDefaultClassType] = useState<ClassType>(() => {
    return (localStorage.getItem('school_default_class_type') as ClassType) || 'zoom';
  });

  const handleSetDefaultClassType = (type: ClassType) => {
    setDefaultClassType(type);
    localStorage.setItem('school_default_class_type', type);
  };

  const handleUpdateAllClassType = async (targetType: ClassType = defaultClassType) => {
    if (!user) return;
    const typeLabel = targetType === 'zoom' ? '💻 Zoom' : targetType === 'ondemand' ? '📺 オンデマンド' : '🏫 対面';
    if (timetable.length === 0) {
      alert('時間割に授業がまだ登録されていません。');
      return;
    }
    const isConfirmed = window.confirm(
      `【確認】\n現在時間割に登録されているすべての授業（${timetable.length}コマ）の受講スタイルを一括で「${typeLabel}」に変更しますか？`
    );
    if (!isConfirmed) return;

    try {
      const count = await updateAllTimetableClassType(user.uid, targetType);
      alert(`時間割の全授業（${count}コマ）を一括で「${typeLabel}」に変更しました！`);
    } catch (err) {
      console.error(err);
      alert('一括変更に失敗しました。');
    }
  };

  // Timetable Drag and Drop State
  const [draggedCellItem, setDraggedCellItem] = useState<TimetableItem | null>(null);
  const [dragOverCell, setDragOverCell] = useState<{ day: string; period: number } | null>(null);
  const [isDraggingNow, setIsDraggingNow] = useState(false);

  // Zustand Store hooks
  const {
    timetable,
    assignments,
    tests,
    shifts,
    initData,
    cleanup,
    saveTimetableCell,
    updateAllTimetableClassType,
    deleteTimetableCell,
    registerTimetableForDates,
    deleteTimetableForDates,
    setSchoolSyncEnabled,
    addAssignment,
    toggleAssignment,
    deleteAssignment,
    addTest,
    deleteTest,
    addShift,
    updateShift,
    deleteShift
  } = useAppStore();

  // Timetable Edit Modal State
  const [editingCell, setEditingCell] = useState<{
    id?: string;
    day: string;
    period: number;
    subject: string;
    startTime: string;
    endTime: string;
    classType?: ClassType;
    classroom?: string;
  } | null>(null);

  // Bulk Timetable Edit State
  const [isBulkEditOpen, setIsBulkEditOpen] = useState(false);
  const [bulkCells, setBulkCells] = useState<Record<string, string>>({});
  const [bulkPasteText, setBulkPasteText] = useState('');
  const [timetableImage, setTimetableImage] = useState<File | null>(null);
  const [isReadingTimetable, setIsReadingTimetable] = useState(false);
  const [timetableReadError, setTimetableReadError] = useState('');
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem('sw_gemini_api_key') || '');

  // Add Assignment Form State
  const [newAssignmentTitle, setNewAssignmentTitle] = useState('');
  const [newAssignmentDueDate, setNewAssignmentDueDate] = useState('');

  // Add Test Form State
  const [newTestTitle, setNewTestTitle] = useState('');
  const [newTestDate, setNewTestDate] = useState('');

  // Add Shift Modal/Form State
  const [isAddShiftOpen, setIsAddShiftOpen] = useState(false);
  const [newShiftStore, setNewShiftStore] = useState('マック');
  const [newShiftCustomStore, setNewShiftCustomStore] = useState('');
  const [newShiftDate, setNewShiftDate] = useState(new Date().toISOString().split('T')[0]);
  const [newShiftStartTime, setNewShiftStartTime] = useState('18:00');
  const [newShiftEndTime, setNewShiftEndTime] = useState('22:00');
  const [newShiftWage, setNewShiftWage] = useState(1150);
  const [newShiftBreakMinutes, setNewShiftBreakMinutes] = useState(0);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);

  const openAddShiftModal = () => {
    setEditingShift(null);
    setNewShiftStore('マック');
    setNewShiftCustomStore('');
    setNewShiftDate(new Date().toISOString().split('T')[0]);
    setNewShiftStartTime('18:00');
    setNewShiftEndTime('22:00');
    setNewShiftWage(1150);
    setNewShiftBreakMinutes(0);
    setIsAddShiftOpen(true);
  };

  const openEditShiftModal = (shift: Shift) => {
    setEditingShift(shift);
    const startDateObj = new Date(shift.startTime);
    const endDateObj = new Date(shift.endTime);
    const dateStr = startDateObj.toISOString().split('T')[0];

    const formatTimePart = (d: Date) => {
      const h = String(d.getHours()).padStart(2, '0');
      const m = String(d.getMinutes()).padStart(2, '0');
      return `${h}:${m}`;
    };

    const presetStores = ['マック', 'ローソン', 'スタバ', 'その他'];
    if (presetStores.includes(shift.store)) {
      setNewShiftStore(shift.store);
      setNewShiftCustomStore('');
    } else {
      setNewShiftStore('カスタム');
      setNewShiftCustomStore(shift.store);
    }

    setNewShiftDate(dateStr);
    setNewShiftStartTime(formatTimePart(startDateObj));
    setNewShiftEndTime(formatTimePart(endDateObj));
    setNewShiftWage(shift.hourlyWage);
    setNewShiftBreakMinutes(shift.breakMinutes || 0);
    setIsAddShiftOpen(true);
  };

  // Read URL query params on mount to select initial tab (e.g. ?tab=work)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabParam = params.get('tab');
    if (tabParam === 'school' || tabParam === 'work') {
      setActiveMainTab(tabParam);
    }
  }, []);

  useEffect(() => {
    setIsSchoolSyncEnabled(localStorage.getItem('school-life-os-sync') === 'enabled');
  }, []);

  const toggleSchoolSync = async () => {
    if (!user) return;
    const nextEnabled = !isSchoolSyncEnabled;
    try {
      await setSchoolSyncEnabled(user.uid, nextEnabled);
      localStorage.setItem('school-life-os-sync', nextEnabled ? 'enabled' : 'disabled');
      setIsSchoolSyncEnabled(nextEnabled);
    } catch (err) {
      console.error(err);
      alert('連携設定の変更に失敗しました。');
    }
  };

  type SyncPeriodKey = 'this-week' | 'next-week' | 'next-two-weeks' | 'this-month';

  interface SyncTargetDate {
    day: string;
    date: Date;
    dateStr: string;
    displayDate: string;
  }

  const getPeriodTargetDates = (key: SyncPeriodKey): SyncTargetDate[] => {
    const now = new Date();
    const dayJaList = ['日', '月', '火', '水', '木', '金', '土'];
    const pad = (n: number) => String(n).padStart(2, '0');
    const toTarget = (d: Date): SyncTargetDate => {
      const year = d.getFullYear();
      const month = d.getMonth() + 1;
      const dayNum = d.getDate();
      const dayJa = dayJaList[d.getDay()];
      return {
        day: dayJa,
        date: new Date(year, month - 1, dayNum, 12, 0, 0),
        dateStr: `${year}-${pad(month)}-${pad(dayNum)}`,
        displayDate: `${month}/${dayNum} (${dayJa})`
      };
    };

    if (key === 'this-week' || key === 'next-week' || key === 'next-two-weeks') {
      const mondayOffset = now.getDay() === 0 ? -6 : 1 - now.getDay();
      const weekShift = key === 'this-week' ? 0 : key === 'next-week' ? 7 : 14;
      const result: SyncTargetDate[] = [];
      for (let i = 0; i < 5; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + mondayOffset + weekShift + i);
        result.push(toTarget(d));
      }
      return result;
    }

    if (key === 'this-month') {
      const year = now.getFullYear();
      const month = now.getMonth();
      const lastDay = new Date(year, month + 1, 0).getDate();
      const result: SyncTargetDate[] = [];
      for (let i = 1; i <= lastDay; i++) {
        const d = new Date(year, month, i);
        if (d.getDay() >= 1 && d.getDay() <= 5) {
          result.push(toTarget(d));
        }
      }
      return result;
    }

    return [];
  };

  const currentSyncTargetDates = getPeriodTargetDates(syncPeriodKey);

  const syncPeriodOptions: { key: SyncPeriodKey; label: string; rangeText: string }[] = [
    (() => {
      const dates = getPeriodTargetDates('this-week');
      const start = dates[0]?.displayDate || '';
      const end = dates[dates.length - 1]?.displayDate || '';
      return {
        key: 'this-week' as SyncPeriodKey,
        label: '今週 (1週間)',
        rangeText: `${start} 〜 ${end}`
      };
    })(),
    (() => {
      const dates = getPeriodTargetDates('next-week');
      const start = dates[0]?.displayDate || '';
      const end = dates[dates.length - 1]?.displayDate || '';
      return {
        key: 'next-week' as SyncPeriodKey,
        label: '来週 (1週間)',
        rangeText: `${start} 〜 ${end}`
      };
    })(),
    (() => {
      const dates = getPeriodTargetDates('next-two-weeks');
      const start = dates[0]?.displayDate || '';
      const end = dates[dates.length - 1]?.displayDate || '';
      return {
        key: 'next-two-weeks' as SyncPeriodKey,
        label: '再来週 (1週間)',
        rangeText: `${start} 〜 ${end}`
      };
    })(),
    (() => {
      const now = new Date();
      const month = now.getMonth() + 1;
      const dates = getPeriodTargetDates('this-month');
      return {
        key: 'this-month' as SyncPeriodKey,
        label: `今月 (${month}月中・1か月)`,
        rangeText: `平日全${dates.length}日間`
      };
    })()
  ];

  const syncPreviewItems = currentSyncTargetDates.map(target => {
    const dayClasses = timetable
      .filter(item => item.day === target.day)
      .sort((a, b) => a.period - b.period);
    return {
      target,
      classes: dayClasses
    };
  });
  const totalClassesToRegister = syncPreviewItems.reduce((acc, curr) => acc + curr.classes.length, 0);

  const handleRegisterTimetableToLifeOs = async () => {
    if (!user || !isSchoolSyncEnabled) return;
    if (totalClassesToRegister === 0) {
      alert('登録対象の授業が時間割に登録されていません。先に時間割を入力してください。');
      return;
    }
    setIsRegisteringToLifeOs(true);
    try {
      const count = await registerTimetableForDates(
        user.uid,
        timetable,
        currentSyncTargetDates.map(t => ({ day: t.day, date: t.date }))
      );
      setIsSchoolSyncPromptOpen(false);
      alert(`Life OSに ${count} 件の授業予定を登録しました！\nLife OS側で予定の確認や変更が可能です。`);
    } catch (err) {
      console.error(err);
      alert('Life OSへの登録に失敗しました。');
    } finally {
      setIsRegisteringToLifeOs(false);
    }
  };

  const handleDeleteTimetableFromLifeOs = async () => {
    if (!user || !isSchoolSyncEnabled) return;
    const selectedOption = syncPeriodOptions.find(o => o.key === syncPeriodKey);
    const periodLabel = selectedOption ? `${selectedOption.label}（${selectedOption.rangeText}）` : '選択中の期間';

    const isConfirmed = window.confirm(
      `【確認】\nLife OSから「${periodLabel}」の授業予定を一括削除しますか？\n\n※この期間に時間割から登録された学校授業の予定（最大 ${totalClassesToRegister} 件）がカレンダーから取り消されます。\n※個別に編集したメモなども削除されます。`
    );
    if (!isConfirmed) return;

    setIsDeletingFromLifeOs(true);
    try {
      const count = await deleteTimetableForDates(
        user.uid,
        timetable,
        currentSyncTargetDates.map(t => ({ day: t.day, date: t.date }))
      );
      setIsSchoolSyncPromptOpen(false);
      alert(`Life OSから該当期間の授業予定（${count}コマ分）を取り消し・削除しました。`);
    } catch (err) {
      console.error(err);
      alert('Life OSからの予定削除に失敗しました。');
    } finally {
      setIsDeletingFromLifeOs(false);
    }
  };

  // Firebase Auth Observer
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        initData(currentUser.uid);
      } else {
        cleanup();
      }
    });
    return () => unsubscribe();
  }, [initData, cleanup]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!authEmail || !authPassword) {
      setAuthError('メールアドレスとパスワードを入力してください。');
      return;
    }

    if (authMode === 'register') {
      if (authPassword.length < 6) {
        setAuthError('パスワードは6文字以上で入力してください。');
        return;
      }
      if (authPassword !== authConfirmPassword) {
        setAuthError('パスワードが一致しません。');
        return;
      }
    }

    setAuthLoading(true);
    setAuthError('');
    try {
      if (authMode === 'login') {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        await createUserWithEmailAndPassword(auth, authEmail, authPassword);
      }
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/wrong-password' || err.code === 'auth/user-not-found') {
        setAuthError('メールアドレスまたはパスワードが正しくありません。');
      } else if (err.code === 'auth/email-already-in-use') {
        setAuthError('このメールアドレスはすでに使用されています。');
      } else {
        setAuthError(`認証エラー: ${err.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSaveTimetable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !editingCell) return;
    try {
      await saveTimetableCell(user.uid, editingCell);
      setEditingCell(null);
    } catch (err) {
      console.error(err);
      alert('保存に失敗しました。');
    }
  };

  const handleDeleteTimetable = async (id: string) => {
    if (!user || !confirm('この授業を削除しますか？')) return;
    try {
      await deleteTimetableCell(user.uid, id);
      setEditingCell(null);
    } catch (err) {
      console.error(err);
      alert('削除に失敗しました。');
    }
  };

  const handleAddAssignmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newAssignmentTitle || !newAssignmentDueDate) return;
    try {
      await addAssignment(user.uid, {
        title: newAssignmentTitle,
        dueDate: newAssignmentDueDate
      });
      setNewAssignmentTitle('');
      setNewAssignmentDueDate('');
    } catch (err) {
      console.error(err);
      alert('追加に失敗しました。');
    }
  };

  const handleAddTestSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newTestTitle || !newTestDate) return;
    try {
      await addTest(user.uid, {
        title: newTestTitle,
        date: newTestDate
      });
      setNewTestTitle('');
      setNewTestDate('');
    } catch (err) {
      console.error(err);
      alert('追加に失敗しました。');
    }
  };

  const handleAddShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    try {
      const storeName = newShiftStore === 'カスタム' ? newShiftCustomStore : newShiftStore;
      const startDateTimeStr = `${newShiftDate}T${newShiftStartTime}`;
      const endDateTimeStr = `${newShiftDate}T${newShiftEndTime}`;

      const shiftData = {
        store: storeName,
        startTime: startDateTimeStr,
        endTime: endDateTimeStr,
        hourlyWage: Number(newShiftWage),
        breakMinutes: Number(newShiftBreakMinutes)
      };

      if (editingShift) {
        await updateShift(user.uid, editingShift.id, shiftData);
      } else {
        await addShift(user.uid, shiftData);
      }

      setIsAddShiftOpen(false);
      setEditingShift(null);
      setNewShiftCustomStore('');
    } catch (err) {
      console.error(err);
      alert(editingShift ? 'シフトの更新に失敗しました。' : 'シフトの追加に失敗しました。');
    }
  };

  // Helper values
  const weekdays = ['月', '火', '水', '木', '金'];
  const periods = [1, 2, 3, 4, 5];

  // Standard period times (授業時間)
  const defaultPeriodTimes: Record<number, { startTime: string; endTime: string }> = {
    1: { startTime: '09:10', endTime: '10:40' },
    2: { startTime: '10:50', endTime: '12:20' },
    3: { startTime: '13:10', endTime: '14:40' },
    4: { startTime: '14:50', endTime: '16:20' },
    5: { startTime: '16:30', endTime: '18:00' },
  };

  const handleApplyDefaultTimesToAll = async () => {
    if (!user || timetable.length === 0) return;
    if (!confirm('登録済みのすべての授業時間を標準時間（1限: 09:10〜, 2限: 10:50〜, 3限: 13:10〜, 4限: 14:50〜, 5限: 16:30〜）に更新しますか？')) {
      return;
    }
    try {
      for (const item of timetable) {
        const def = defaultPeriodTimes[item.period];
        if (def && (item.startTime !== def.startTime || item.endTime !== def.endTime)) {
          await saveTimetableCell(user.uid, {
            ...item,
            startTime: def.startTime,
            endTime: def.endTime
          });
        }
      }
      alert('すべての授業時間を標準時間に更新しました！');
    } catch (err) {
      console.error(err);
      alert('授業時間の更新に失敗しました。');
    }
  };

  // ==================== 時間割 一括入力 ====================
  const openBulkEditTimetable = () => {
    const cells: Record<string, string> = {};
    weekdays.forEach(day => {
      periods.forEach(period => {
        cells[`${day}-${period}`] = findTimetableItem(day, period)?.subject || '';
      });
    });
    setBulkCells(cells);
    setBulkPasteText('');
    setTimetableImage(null);
    setTimetableReadError('');
    setIsBulkEditOpen(true);
  };

  const handleBulkSaveTimetable = async () => {
    if (!user) return;
    try {
      let changed = 0;
      for (const day of weekdays) {
        for (const period of periods) {
          const subject = (bulkCells[`${day}-${period}`] || '').trim();
          const existing = findTimetableItem(day, period);
          if (subject && existing) {
            if (existing.subject !== subject) {
              await saveTimetableCell(user.uid, { ...existing, subject });
              changed++;
            }
          } else if (subject && !existing) {
            const def = defaultPeriodTimes[period] || { startTime: '09:10', endTime: '10:40' };
            await saveTimetableCell(user.uid, { day, period, subject, startTime: def.startTime, endTime: def.endTime });
            changed++;
          } else if (!subject && existing) {
            await deleteTimetableCell(user.uid, existing.id);
            changed++;
          }
        }
      }
      setIsBulkEditOpen(false);
      alert(changed > 0 ? `時間割を保存しました(${changed}件)。授業時間は標準時間で登録されています。` : '変更はありませんでした。');
    } catch (err) {
      console.error(err);
      alert('時間割の一括保存に失敗しました。');
    }
  };

  const applyBulkPasteText = () => {
    const lines = bulkPasteText.split(/\r?\n/).map(l => l.trim()).filter(l => l.length > 0);
    if (lines.length === 0) return;
    const daySet = new Set(weekdays);
    const toHalfWidth = (s: string) => s.replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
    const cells = { ...bulkCells };
    let applied = 0;
    const badLines: number[] = [];
    lines.forEach((line, idx) => {
      const tokens = line.split(/[\s,、\t]+/).filter(Boolean);
      if (tokens.length < 3) { badLines.push(idx + 1); return; }
      const day = daySet.has(tokens[0]) ? tokens[0] : '';
      const period = Number(toHalfWidth(tokens[1]).replace(/限/g, ''));
      const subject = tokens.slice(2).join(' ');
      if (!day || !period || period < 1 || period > 5 || !subject) { badLines.push(idx + 1); return; }
      cells[`${day}-${period}`] = subject;
      applied++;
    });
    setBulkCells(cells);
    if (badLines.length > 0) {
      alert(`${applied}件を反映しました。読み取れない行: ${badLines.join(', ')}行目\n※「月 1 科目名」の形式で入力してください。`);
    }
  };

  const handleReadTimetablePhoto = async () => {
    if (!timetableImage) return;
    if (!geminiApiKey) { setTimetableReadError('Gemini APIキーを入力してください。'); return; }
    setIsReadingTimetable(true);
    setTimetableReadError('');
    try {
      localStorage.setItem('sw_gemini_api_key', geminiApiKey);
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('画像の読み込みに失敗しました。'));
        reader.readAsDataURL(timetableImage);
      });
      const base64 = dataUrl.split(',')[1];
      const mimeMatch = dataUrl.match(/^data:(.*?);/);
      const mimeType = mimeMatch ? mimeMatch[1] : 'image/png';
      const prompt = 'これは学校の時間割の画像です。曜日のブロックは上から月,火,水,木,金の順、各ブロック内の行は上から1限,2限,3限,4限,5限の順として科目名を読み取ってください。空欄のマスは含めないでください。科目名に含まれる「※」以降の注釈は除いてください。次の形式のJSON配列のみを出力してください(説明文やコードブロック記号は不要): [{"day":"月","period":1,"subject":"科目名"}]';
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${encodeURIComponent(geminiApiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }, { inline_data: { mime_type: mimeType, data: base64 } }] }],
          generationConfig: { temperature: 0 }
        })
      });
      if (!res.ok) {
        throw new Error(`Gemini APIエラー (${res.status})`);
      }
      const json = await res.json();
      const text: string = (json?.candidates?.[0]?.content?.parts || []).map((p: { text?: string }) => p.text || '').join('');
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) throw new Error('読み取り結果を解析できませんでした。');
      const entries: { day: string; period: number; subject: string }[] = JSON.parse(jsonMatch[0]);
      const cells = { ...bulkCells };
      let count = 0;
      entries.forEach(e => {
        if (weekdays.includes(e.day) && e.period >= 1 && e.period <= 5 && e.subject) {
          cells[`${e.day}-${e.period}`] = String(e.subject).trim();
          count++;
        }
      });
      if (count === 0) throw new Error('時間割の科目が見つかりませんでした。');
      setBulkCells(cells);
      alert(`${count}件の科目をグリッドに反映しました。内容を確認して「まとめて保存」を押してください。`);
    } catch (err) {
      console.error(err);
      setTimetableReadError(err instanceof Error ? err.message : '写真の読み取りに失敗しました。');
    } finally {
      setIsReadingTimetable(false);
    }
  };

  // Helper: Calculate remaining days
  const getRemainingDaysLabel = (targetDateStr: string) => {
    const todayDate = new Date();
    todayDate.setHours(0, 0, 0, 0);
    const targetDate = new Date(targetDateStr);
    targetDate.setHours(0, 0, 0, 0);
    const diffTime = targetDate.getTime() - todayDate.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return { text: `超過 ${Math.abs(diffDays)}日`, colorClass: 'bg-red-500/10 text-red-400 border border-red-500/20' };
    } else if (diffDays === 0) {
      return { text: '今日締め切り', colorClass: 'bg-red-500 text-white font-bold' };
    } else if (diffDays === 1) {
      return { text: '明日締め切り', colorClass: 'bg-orange-500 text-white font-bold' };
    } else if (diffDays <= 3) {
      return { text: `残り ${diffDays}日`, colorClass: 'bg-[#ef8f3b]/15 text-[#ef8f3b] border border-[#ef8f3b]/25 font-bold' };
    } else {
      return { text: `残り ${diffDays}日`, colorClass: 'bg-white/5 text-[#94a3b8] border border-white/5' };
    }
  };

  // Helper: Find class for a specific day and period
  const findTimetableItem = (day: string, period: number) => {
    return timetable.find(t => t.day === day && t.period === period);
  };

  // Drag and Drop Handler for Timetable Cells
  const handleDropOnCell = async (targetDay: string, targetPeriod: number) => {
    setDragOverCell(null);
    if (!draggedCellItem || !user) return;
    if (draggedCellItem.day === targetDay && draggedCellItem.period === targetPeriod) {
      return;
    }

    const targetExistingItem = findTimetableItem(targetDay, targetPeriod);
    const targetPeriodTime = defaultPeriodTimes[targetPeriod] || { startTime: '09:10', endTime: '10:40' };
    const sourcePeriodTime = defaultPeriodTimes[draggedCellItem.period] || { startTime: '09:10', endTime: '10:40' };

    try {
      if (targetExistingItem) {
        // 2つのコマを入れ替え（スワップ）
        await Promise.all([
          saveTimetableCell(user.uid, {
            ...draggedCellItem,
            day: targetDay,
            period: targetPeriod,
            startTime: targetPeriodTime.startTime,
            endTime: targetPeriodTime.endTime
          }),
          saveTimetableCell(user.uid, {
            ...targetExistingItem,
            day: draggedCellItem.day,
            period: draggedCellItem.period,
            startTime: sourcePeriodTime.startTime,
            endTime: sourcePeriodTime.endTime
          })
        ]);
      } else {
        // 空きマスへの移動
        await saveTimetableCell(user.uid, {
          ...draggedCellItem,
          day: targetDay,
          period: targetPeriod,
          startTime: targetPeriodTime.startTime,
          endTime: targetPeriodTime.endTime
        });
      }
    } catch (err) {
      console.error('Drag and drop failed:', err);
      alert('授業の移動に失敗しました。');
    } finally {
      setDraggedCellItem(null);
    }
  };

  // Helper: Sort assignments
  const activeAssignments = assignments.filter(a => !a.completed).sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const completedAssignments = assignments.filter(a => a.completed);

  // Helper: Sort tests
  const sortedTests = [...tests].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Helper: Calculate monthly salary and hours for Shifts
  const currentMonthStr = new Date().toISOString().substring(0, 7); // 'YYYY-MM'
  const monthlyShifts = shifts.filter(s => s.startTime.startsWith(currentMonthStr));
  
  const monthlyTotalHours = monthlyShifts.reduce((sum, s) => sum + s.workHours, 0);
  const monthlyEstimatedPay = monthlyShifts.reduce((sum, s) => sum + s.estimatedPay, 0);

  // Helper: Calculate weekly shifts (current week Mon-Sun)
  const getStartOfWeek = () => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const mon = new Date(today.setDate(diff));
    mon.setHours(0,0,0,0);
    return mon;
  };
  const startOfWeek = getStartOfWeek();
  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  const weeklyShifts = shifts.filter(s => {
    const d = new Date(s.startTime);
    return d >= startOfWeek && d < endOfWeek;
  }).sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1115] text-[#f8fafc] px-4">
        <div className="w-full max-w-md bg-[#1a1d24] border border-white/5 rounded-3xl p-8 shadow-2xl">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-[#4b88ff] flex items-center justify-center shadow-lg shadow-[#4b88ff]/20 mb-3">
              <BookOpen className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-wide">School & Work</h1>
            <p className="text-xs text-[#94a3b8] mt-1">時間割とシフトを効率的に管理</p>
          </div>

          <form onSubmit={handleAuthSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-2">メールアドレス</label>
              <input 
                type="email" 
                placeholder="your@email.com"
                required
                className="w-full px-4 py-3 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] transition-all text-sm"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#94a3b8] mb-2">パスワード</label>
              <input 
                type="password" 
                placeholder="••••••••"
                required
                className="w-full px-4 py-3 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] transition-all text-sm"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
              />
            </div>

            {authMode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-[#94a3b8] mb-2">パスワード（確認用）</label>
                <input 
                  type="password" 
                  placeholder="••••••••"
                  required
                  className="w-full px-4 py-3 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] transition-all text-sm"
                  value={authConfirmPassword}
                  onChange={e => setAuthConfirmPassword(e.target.value)}
                />
              </div>
            )}

            {authError && (
              <div className="flex items-center gap-2 text-red-400 text-xs bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button 
              type="submit" 
              disabled={authLoading}
              className="w-full py-3 bg-[#4b88ff] hover:bg-[#3b78ef] text-white font-bold rounded-xl shadow-lg shadow-[#4b88ff]/15 transition-all text-sm active:scale-[0.98] disabled:opacity-50"
            >
              {authLoading ? '送信中...' : authMode === 'login' ? 'ログイン' : '新規アカウント作成'}
            </button>
          </form>

          <div className="text-center mt-6 text-xs text-[#94a3b8]">
            {authMode === 'login' ? (
              <p>
                アカウントをお持ちでないですか？{' '}
                <span 
                  onClick={() => { setAuthMode('register'); setAuthError(''); setAuthPassword(''); setAuthConfirmPassword(''); }}
                  className="text-[#4b88ff] hover:underline cursor-pointer font-semibold"
                >
                  新規登録
                </span>
              </p>
            ) : (
              <p>
                すでにアカウントをお持ちですか？{' '}
                <span 
                  onClick={() => { setAuthMode('login'); setAuthError(''); setAuthPassword(''); setAuthConfirmPassword(''); }}
                  className="text-[#4b88ff] hover:underline cursor-pointer font-semibold"
                >
                  ログイン
                </span>
              </p>
            )}
            
            <a
              href={
                window.location.hostname === "localhost"
                  ? "http://localhost:5173/life-os/"
                  : "https://ta1you.github.io/life-os/"
              }
              className="inline-block mt-4 text-[#94a3b8]/60 hover:text-[#f8fafc] hover:underline"
            >
              Life OS ログイン画面に戻る
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1115] text-[#f8fafc] flex flex-col max-w-md mx-auto relative pb-20 shadow-xl border-x border-white/5">
      {/* Header */}
      <header className="sticky top-0 bg-[#0f1115]/95 backdrop-blur-md z-40 border-b border-white/5 px-5 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[#4b88ff] flex items-center justify-center">
            {activeMainTab === 'school' ? <BookOpen className="w-4 h-4 text-white" /> : <Briefcase className="w-4 h-4 text-white" />}
          </div>
          <div>
            <h1 className="font-extrabold text-sm tracking-wide">
              {activeMainTab === 'school' ? 'School & Work (学校)' : 'School & Work (バイト)'}
            </h1>
            <p className="text-[10px] text-[#94a3b8]">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={
              window.location.hostname === 'localhost'
                ? 'http://localhost:5173/life-os/'
                : 'https://ta1you.github.io/life-os/'
            }
            className="px-3 py-1.5 bg-[#1a1d24] text-xs font-semibold rounded-full border border-white/5 text-[#94a3b8] hover:text-[#f8fafc] transition-all"
          >
            Life OSに戻る
          </a>
          <button 
            onClick={() => signOut(auth)}
            className="p-1.5 bg-[#1a1d24] text-red-400 hover:bg-red-500/10 rounded-full border border-white/5 transition-all"
            title="ログアウト"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 p-5 overflow-y-auto">
        {/* Main Tab Controller */}
        <div className="flex bg-[#1a1d24] border border-white/5 p-1 rounded-xl mb-6">
          <button 
            onClick={() => setActiveMainTab('school')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold text-sm rounded-lg transition-all ${
              activeMainTab === 'school' 
                ? 'bg-[#4b88ff] text-white shadow-lg shadow-[#4b88ff]/15' 
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            学校
          </button>
          <button 
            onClick={() => setActiveMainTab('work')}
            className={`flex-1 py-2.5 flex items-center justify-center gap-2 font-bold text-sm rounded-lg transition-all ${
              activeMainTab === 'work' 
                ? 'bg-[#ef8f3b] text-white shadow-lg shadow-[#ef8f3b]/15' 
                : 'text-[#94a3b8] hover:text-[#f8fafc]'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            バイト
          </button>
        </div>

        {/* -------------------- SCHOOL SCREEN -------------------- */}
        {activeMainTab === 'school' && (
          <div>
            {/* School Sub-tabs */}
            <div className="flex border-b border-white/5 mb-6 text-sm">
              <button 
                onClick={() => setSchoolSubTab('timetable')}
                className={`flex-1 pb-3 font-semibold transition-all relative ${
                  schoolSubTab === 'timetable' ? 'text-[#4b88ff] font-bold' : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                時間割
                {schoolSubTab === 'timetable' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4b88ff] rounded-full"></div>
                )}
              </button>
              <button 
                onClick={() => setSchoolSubTab('assignments')}
                className={`flex-1 pb-3 font-semibold transition-all relative ${
                  schoolSubTab === 'assignments' ? 'text-[#4b88ff] font-bold' : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                課題
                {schoolSubTab === 'assignments' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4b88ff] rounded-full"></div>
                )}
              </button>
              <button 
                onClick={() => setSchoolSubTab('tests')}
                className={`flex-1 pb-3 font-semibold transition-all relative ${
                  schoolSubTab === 'tests' ? 'text-[#4b88ff] font-bold' : 'text-[#94a3b8] hover:text-[#f8fafc]'
                }`}
              >
                テスト
                {schoolSubTab === 'tests' && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#4b88ff] rounded-full"></div>
                )}
              </button>
            </div>

            {/* TIMETABLE VIEW */}
            {schoolSubTab === 'timetable' && (
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-sm text-[#94a3b8]">今学期の時間割</h3>
                  <button
                    type="button"
                    onClick={toggleSchoolSync}
                    className={`text-[10px] px-2.5 py-1 rounded-full font-bold border transition-all ${
                      isSchoolSyncEnabled
                        ? 'bg-[#34d399]/10 text-[#34d399] border-[#34d399]/20'
                        : 'bg-white/5 text-[#94a3b8] border-white/10'
                    }`}
                  >
                    Life OS連携: {isSchoolSyncEnabled ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* 基本受講スタイル（初期値）設定バー */}
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 bg-[#1a1d24] border border-white/5 p-3 rounded-2xl">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-bold text-[#f8fafc]">基本の受講スタイル</span>
                      <span className="text-[10px] text-[#94a3b8]">(新規登録時の初期値)</span>
                    </div>
                    <p className="text-[10px] text-[#64748b] mt-0.5">
                      授業を追加するときに自動選択される受講形態を設定できます
                    </p>
                  </div>
                  <div className="flex gap-1 bg-[#0f1115] p-1 rounded-xl border border-white/5 shrink-0">
                    {[
                      { type: 'zoom', label: '💻 Zoom' },
                      { type: 'ondemand', label: '📺 オンデマンド' },
                      { type: 'in_person', label: '🏫 対面' }
                    ].map(opt => (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => handleSetDefaultClassType(opt.type as ClassType)}
                        className={`px-3 py-1.5 text-xs rounded-lg font-bold transition-all cursor-pointer ${
                          defaultClassType === opt.type
                            ? opt.type === 'zoom'
                              ? 'bg-[#8b5cf6] text-white shadow-sm'
                              : opt.type === 'ondemand'
                              ? 'bg-[#10b981] text-white shadow-sm'
                              : 'bg-[#4b88ff] text-white shadow-sm'
                            : 'text-[#94a3b8] hover:text-[#f8fafc]'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* 既存の授業を一括変更するボタン */}
                {timetable.length > 0 && (
                  <button
                    type="button"
                    onClick={() => handleUpdateAllClassType(defaultClassType)}
                    className="w-full py-2 bg-[#8b5cf6]/10 hover:bg-[#8b5cf6]/20 border border-[#8b5cf6]/25 text-[#c4b5fd] rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                  >
                    <span>⚡ 現在の時間割（{timetable.length}コマ）をすべて「{defaultClassType === 'zoom' ? '💻 Zoom' : defaultClassType === 'ondemand' ? '📺 オンデマンド' : '🏫 対面'}」に変更</span>
                  </button>
                )}

                {isSchoolSyncEnabled && (
                  <button
                    type="button"
                    onClick={() => setIsSchoolSyncPromptOpen(true)}
                    className="w-full py-2.5 bg-[#4b88ff] hover:bg-[#3b78ef] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <CalendarIcon className="w-3.5 h-3.5" />
                    期間を選んで時間割をLife OSに登録
                  </button>
                )}

                <button
                  type="button"
                  onClick={openBulkEditTimetable}
                  className="w-full py-2.5 bg-[#1a1d24] hover:bg-[#232733] text-[#f8fafc] font-bold rounded-xl text-xs border border-white/10 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  時間割を一括入力（写真読み取り・まとめ入力）
                </button>

                {/* Timetable Grid */}
                <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#1a1d24]">
                  <table className="w-full border-collapse text-xs text-center min-w-[320px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0f1115]/40 text-[#94a3b8] font-bold">
                        <th className="py-2.5 w-14 border-r border-white/5 text-[10px]">時限</th>
                        {weekdays.map(day => (
                          <th key={day} className="py-2.5 border-r border-white/5 last:border-r-0">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(period => {
                        const periodDefault = defaultPeriodTimes[period] || { startTime: '09:10', endTime: '10:40' };
                        return (
                          <tr key={period} className="border-b border-white/5 last:border-b-0">
                            <td className="py-2.5 px-1 font-bold border-r border-white/5 bg-[#0f1115]/20 text-[#94a3b8] text-center">
                              <span className="text-xs">{period}限</span>
                              <span className="block text-[8px] text-[#94a3b8]/60 font-normal leading-tight mt-0.5 whitespace-nowrap">
                                {periodDefault.startTime}
                                <br />
                                {periodDefault.endTime}
                              </span>
                            </td>
                            {weekdays.map(day => {
                              const item = findTimetableItem(day, period);
                              const isTargetOver = dragOverCell?.day === day && dragOverCell?.period === period;
                              const isBeingDragged = draggedCellItem?.id === item?.id;

                              return (
                                <td 
                                  key={day} 
                                  onDragOver={(e) => {
                                    e.preventDefault();
                                    e.dataTransfer.dropEffect = 'move';
                                    if (dragOverCell?.day !== day || dragOverCell?.period !== period) {
                                      setDragOverCell({ day, period });
                                    }
                                  }}
                                  onDragLeave={(e) => {
                                    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                                    setDragOverCell(null);
                                  }}
                                  onDrop={(e) => {
                                    e.preventDefault();
                                    handleDropOnCell(day, period);
                                  }}
                                  onClick={() => {
                                    if (isDraggingNow) return;
                                    setEditingCell(item ? {
                                       ...item,
                                       classType: item.classType || defaultClassType,
                                       classroom: item.classroom || ''
                                     } : {
                                      day,
                                      period,
                                      subject: '',
                                      startTime: periodDefault.startTime,
                                      endTime: periodDefault.endTime,
                                      classType: defaultClassType,
                                      classroom: ''
                                    });
                                  }}
                                  className={`p-1.5 border-r border-white/5 last:border-r-0 cursor-pointer transition-all ${
                                    isTargetOver
                                      ? 'bg-[#4b88ff]/15 ring-2 ring-inset ring-[#4b88ff] rounded-xl'
                                      : 'hover:bg-white/[0.02]'
                                  }`}
                                >
                                  {item ? (
                                    <div 
                                      draggable={true}
                                      onDragStart={(e) => {
                                        setDraggedCellItem(item);
                                        setIsDraggingNow(true);
                                        e.dataTransfer.effectAllowed = 'move';
                                        e.dataTransfer.setData('text/plain', item.id);
                                      }}
                                      onDragEnd={() => {
                                        setDraggedCellItem(null);
                                        setDragOverCell(null);
                                        setTimeout(() => setIsDraggingNow(false), 80);
                                      }}
                                      className={`p-2 rounded-lg font-bold text-[10px] min-h-[64px] flex flex-col justify-between relative group cursor-grab active:cursor-grabbing transition-all ${
                                        isBeingDragged ? 'opacity-30 scale-95' : ''
                                      } ${
                                        item.classType === 'zoom'
                                          ? 'bg-[#8b5cf6]/10 border border-[#8b5cf6]/25 text-[#a78bfa] hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/15'
                                          : item.classType === 'ondemand'
                                          ? 'bg-[#10b981]/10 border border-[#10b981]/25 text-[#34d399] hover:border-[#10b981]/40 hover:bg-[#10b981]/15'
                                          : 'bg-[#4b88ff]/10 border border-[#4b88ff]/20 text-[#4b88ff] hover:border-[#4b88ff]/40 hover:bg-[#4b88ff]/15'
                                      }`}
                                    >
                                      <div>
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="line-clamp-2 text-left flex-1 text-[#f8fafc] font-semibold">{item.subject}</span>
                                          <GripVertical className="w-2.5 h-2.5 opacity-30 group-hover:opacity-80 transition-opacity shrink-0 -mr-0.5 text-[#94a3b8]" />
                                        </div>
                                        {item.classroom && (
                                          <div className="text-[8px] opacity-75 truncate text-left mt-0.5 flex items-center gap-0.5">
                                            {item.classroom.startsWith("http") ? <ExternalLink className="w-2 h-2 shrink-0" /> : <MapPin className="w-2 h-2 shrink-0" />}
                                            <span>{item.classroom.replace(/^https?:\/\//, "")}</span>
                                          </div>
                                        )}
                                      </div>
                                      <div className="mt-1 flex items-center justify-between gap-1 pt-1 border-t border-white/5">
                                        <span className={`text-[8px] px-1 py-0.2 rounded font-medium ${
                                          item.classType === 'zoom'
                                            ? 'bg-[#8b5cf6]/25 text-[#c4b5fd]'
                                            : item.classType === 'ondemand'
                                            ? 'bg-[#10b981]/25 text-[#6ee7b7]'
                                            : 'bg-[#4b88ff]/25 text-[#93c5fd]'
                                        }`}>
                                          {item.classType === 'zoom' ? '💻 Zoom' : item.classType === 'ondemand' ? '📺 オンデマンド' : '🏫 対面'}
                                        </span>
                                        <div className="text-[8px] opacity-75 font-normal flex items-center gap-0.5">
                                          <Clock className="w-2 h-2" />
                                          {item.startTime}
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className={`border border-dashed p-2 rounded-lg min-h-[56px] flex items-center justify-center transition-all ${
                                      isTargetOver 
                                        ? 'border-[#4b88ff] text-[#4b88ff] bg-[#4b88ff]/10 scale-95'
                                        : 'border-white/5 hover:border-white/10 text-white/10 hover:text-white/30'
                                    }`}>
                                      {isTargetOver ? (
                                        <span className="text-[9px] font-bold text-[#4b88ff]">移動</span>
                                      ) : (
                                        <Plus className="w-4 h-4" />
                                      )}
                                    </div>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[10px] text-[#94a3b8] bg-[#1a1d24] border border-white/5 p-3.5 rounded-xl">
                  <span>💡 授業カードをドラッグ＆ドロップして、別の曜日や時限に移動・入れ替えできます（時間は自動調整されます）</span>
                  {timetable.length > 0 && (
                    <button
                      type="button"
                      onClick={handleApplyDefaultTimesToAll}
                      className="text-[#4b88ff] hover:underline font-bold whitespace-nowrap cursor-pointer"
                    >
                      時間を一括更新
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ASSIGNMENTS VIEW */}
            {schoolSubTab === 'assignments' && (
              <div className="space-y-6">
                {/* Form to add Assignment */}
                <form onSubmit={handleAddAssignmentSubmit} className="bg-[#1a1d24] border border-white/5 p-4 rounded-2xl space-y-4 shadow-lg">
                  <h4 className="text-xs font-extrabold text-[#94a3b8] uppercase tracking-wider">課題の追加</h4>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="課題のタイトル（例: データベース課題提出）" 
                      required
                      className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] text-xs transition-all"
                      value={newAssignmentTitle}
                      onChange={e => setNewAssignmentTitle(e.target.value)}
                    />
                    <div className="flex gap-2 items-center">
                      <Clock className="w-4 h-4 text-[#94a3b8]" />
                      <input 
                        type="date" 
                        required
                        className="flex-1 px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] text-xs transition-all"
                        value={newAssignmentDueDate}
                        onChange={e => setNewAssignmentDueDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-2 bg-[#4b88ff] hover:bg-[#3b78ef] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.98] transition-all"
                  >
                    課題を登録
                  </button>
                </form>

                {/* Assignment List */}
                <div className="space-y-4">
                  <h3 className="font-bold text-xs text-[#94a3b8] uppercase tracking-wider">期限前の課題 ({activeAssignments.length})</h3>
                  {activeAssignments.length > 0 ? (
                    <div className="space-y-2.5">
                      {activeAssignments.map(a => (
                        <div key={a.id} className="flex items-center justify-between p-4 bg-[#1a1d24] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                          <div className="flex items-center gap-3">
                            <button 
                              onClick={() => toggleAssignment(user.uid, a.id, true)}
                              className="text-[#94a3b8] hover:text-[#4b88ff] transition-all"
                            >
                              <Square className="w-5 h-5" />
                            </button>
                            <div>
                              <div className="font-bold text-xs flex items-center gap-2">
                                {a.title}
                                {(() => {
                                  const badge = getRemainingDaysLabel(a.dueDate);
                                  return <span className={`px-1.5 py-0.5 rounded text-[8px] ${badge.colorClass}`}>{badge.text}</span>;
                                })()}
                              </div>
                              <div className="text-[10px] text-[#94a3b8] mt-1">期限: {a.dueDate}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteAssignment(user.uid, a.id)}
                            className="text-red-400/60 hover:text-red-400 p-1 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[#94a3b8]/50 bg-[#1a1d24]/40 border border-dashed border-white/5 rounded-2xl">
                      期限前の課題はありません
                    </div>
                  )}

                  {/* Completed Assignments */}
                  {completedAssignments.length > 0 && (
                    <div className="pt-4 space-y-2.5">
                      <h4 className="font-bold text-[10px] text-[#94a3b8]/75 uppercase tracking-wider">完了した課題</h4>
                      <div className="space-y-2.5 opacity-60">
                        {completedAssignments.map(a => (
                          <div key={a.id} className="flex items-center justify-between p-3.5 bg-[#1a1d24]/60 border border-white/5 rounded-2xl">
                            <div className="flex items-center gap-3">
                              <button 
                                onClick={() => toggleAssignment(user.uid, a.id, false)}
                                className="text-[#4b88ff]"
                              >
                                <CheckSquare className="w-5 h-5" />
                              </button>
                              <div>
                                <div className="text-xs line-through text-[#94a3b8]">{a.title}</div>
                              </div>
                            </div>
                            <button 
                              onClick={() => deleteAssignment(user.uid, a.id)}
                              className="text-red-400/40 hover:text-red-400/80 p-1 rounded-full"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TESTS VIEW */}
            {schoolSubTab === 'tests' && (
              <div className="space-y-6">
                {/* Form to add Test */}
                <form onSubmit={handleAddTestSubmit} className="bg-[#1a1d24] border border-white/5 p-4 rounded-2xl space-y-4 shadow-lg">
                  <h4 className="text-xs font-extrabold text-[#94a3b8] uppercase tracking-wider">テスト・レポートの追加</h4>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      placeholder="テスト名またはレポート課題（例: AI演習レポート）" 
                      required
                      className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] text-xs transition-all"
                      value={newTestTitle}
                      onChange={e => setNewTestTitle(e.target.value)}
                    />
                    <div className="flex gap-2 items-center">
                      <CalendarIcon className="w-4 h-4 text-[#94a3b8]" />
                      <input 
                        type="date" 
                        required
                        className="flex-1 px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] text-xs transition-all"
                        value={newTestDate}
                        onChange={e => setNewTestDate(e.target.value)}
                      />
                    </div>
                  </div>
                  <button 
                    type="submit" 
                    className="w-full py-2 bg-[#4b88ff] hover:bg-[#3b78ef] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.98] transition-all"
                  >
                    テストを登録
                  </button>
                </form>

                {/* Test List */}
                <div className="space-y-4">
                  <h3 className="font-bold text-xs text-[#94a3b8] uppercase tracking-wider">今後のテスト・レポート一覧 ({sortedTests.length})</h3>
                  {sortedTests.length > 0 ? (
                    <div className="space-y-2.5">
                      {sortedTests.map(t => (
                        <div key={t.id} className="flex items-center justify-between p-4 bg-[#1a1d24] border border-white/5 rounded-2xl hover:border-white/10 transition-all">
                          <div className="flex items-center gap-3">
                            <div className="w-2.5 h-2.5 rounded-full bg-red-400 flex-shrink-0" />
                            <div>
                              <div className="font-bold text-xs flex items-center gap-2">
                                {t.title}
                                {(() => {
                                  const badge = getRemainingDaysLabel(t.date);
                                  return <span className={`px-1.5 py-0.5 rounded text-[8px] ${badge.colorClass}`}>{badge.text}</span>;
                                })()}
                              </div>
                              <div className="text-[10px] text-[#94a3b8] mt-1">実施日: {t.date}</div>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteTest(user.uid, t.id)}
                            className="text-red-400/60 hover:text-red-400 p-1 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-6 text-xs text-[#94a3b8]/50 bg-[#1a1d24]/40 border border-dashed border-white/5 rounded-2xl">
                      今後のテストはありません
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* -------------------- WORK SCREEN -------------------- */}
        {activeMainTab === 'work' && (
          <div className="space-y-6">
            {/* Salary Prediction Dashboard */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-[#1a1d24] border border-white/5 p-4 rounded-2xl text-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <TrendingUp className="w-16 h-16 text-[#ef8f3b]" />
                </div>
                <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">今月の予想給料</div>
                <div className="text-xl font-black text-[#34d399] tracking-tight">
                  ¥{monthlyEstimatedPay.toLocaleString()}
                </div>
                <div className="text-[9px] text-[#94a3b8] mt-1">{monthlyShifts.length} 回のシフト</div>
              </div>

              <div className="bg-[#1a1d24] border border-white/5 p-4 rounded-2xl text-center shadow-lg relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-5">
                  <Clock className="w-16 h-16 text-[#ef8f3b]" />
                </div>
                <div className="text-[10px] font-semibold text-[#94a3b8] uppercase tracking-wider mb-1">今月の勤務時間</div>
                <div className="text-xl font-black text-[#ef8f3b] tracking-tight">
                  {monthlyTotalHours} <span className="text-xs font-normal text-[#94a3b8]">時間</span>
                </div>
                <div className="text-[9px] text-[#94a3b8] mt-1">今月合計</div>
              </div>
            </div>

            {/* Quick Shift Add Trigger */}
            <button 
              onClick={openAddShiftModal}
              className="w-full py-3 bg-[#ef8f3b] hover:bg-[#df7f2b] text-white font-bold rounded-xl shadow-lg shadow-[#ef8f3b]/15 flex items-center justify-center gap-2 text-sm active:scale-[0.98] transition-all"
            >
              <Plus className="w-4 h-4" />
              シフト追加
            </button>

            {/* Weekly Shifts */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-xs text-[#94a3b8] uppercase tracking-wider">今週のシフト</h3>
                <span className="text-[9px] text-[#94a3b8]/75">自動Life OS連携</span>
              </div>

              {weeklyShifts.length > 0 ? (
                <div className="space-y-3">
                  {weeklyShifts.map(s => {
                    const dateObj = new Date(s.startTime);
                    const formattedDate = `${dateObj.getMonth() + 1}/${dateObj.getDate()} (${weekdays[dateObj.getDay() === 0 ? 6 : dateObj.getDay() - 1] || '日'})`;
                    const startTimeStr = dateObj.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
                    const endTimeStr = new Date(s.endTime).toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });

                    return (
                      <div key={s.id} className="bg-[#1a1d24] border border-white/5 p-4 rounded-2xl flex items-center justify-between shadow-md hover:border-white/10 transition-all">
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => openEditShiftModal(s)}>
                          <div className="w-10 h-10 rounded-xl bg-[#ef8f3b]/10 border border-[#ef8f3b]/20 flex items-center justify-center text-lg text-[#ef8f3b]">
                            🍔
                          </div>
                          <div>
                            <div className="font-bold text-xs flex items-center gap-1.5">
                              {s.store}
                              <span className="text-[10px] text-[#94a3b8] font-normal">{formattedDate}</span>
                            </div>
                            <div className="text-[10px] text-[#94a3b8] mt-1 flex items-center gap-1">
                              <Clock className="w-3 h-3 text-[#94a3b8]/80" />
                              {startTimeStr} 〜 {endTimeStr} ({s.workHours}h{s.breakMinutes > 0 ? ` / 休憩 ${s.breakMinutes}分` : ''})
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="text-right">
                            <div className="text-xs font-bold text-[#34d399]">¥{s.estimatedPay.toLocaleString()}</div>
                            <div className="text-[9px] text-[#94a3b8] mt-0.5">時給 ¥{s.hourlyWage}</div>
                          </div>
                          <button 
                            onClick={() => deleteShift(user.uid, s.id)}
                            className="text-red-400/50 hover:text-red-400 p-1.5 hover:bg-red-500/5 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-[#94a3b8]/50 bg-[#1a1d24]/40 border border-dashed border-white/5 rounded-2xl">
                  今週のシフトはありません
                </div>
              )}
            </div>

            {/* Attendance History (Past shifts) */}
            <div className="space-y-3 pt-2">
              <h4 className="font-bold text-xs text-[#94a3b8] uppercase tracking-wider">シフト履歴（全期間）</h4>
              {shifts.length > 0 ? (
                <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                  {shifts.map(s => {
                    const dateObj = new Date(s.startTime);
                    const formattedDate = `${dateObj.getFullYear()}/${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
                    return (
                      <div key={s.id} className="flex justify-between items-center text-xs p-3 bg-[#1a1d24]/40 border border-white/5 rounded-xl">
                        <div>
                          <span className="font-semibold">{s.store}</span>
                          <span className="text-[#94a3b8] ml-2 text-[10px]">{formattedDate} ({s.workHours}h{s.breakMinutes > 0 ? ` / 休憩 ${s.breakMinutes}分` : ''})</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="font-bold text-[#34d399]">¥{s.estimatedPay.toLocaleString()}</div>
                          <button
                            onClick={() => {
                              if (confirm('このシフトを削除しますか？')) {
                                deleteShift(user.uid, s.id);
                              }
                            }}
                            className="text-red-400/50 hover:text-red-400 p-1.5 hover:bg-red-500/5 rounded-full transition-all"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[10px] text-[#94a3b8]/50">履歴がまだありません</p>
              )}
            </div>
          </div>
        )}
      </main>

      {/* TIMETABLE EDIT CELL MODAL */}
      {editingCell && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="font-extrabold text-sm text-[#f8fafc]">
                {editingCell.day}曜日 {editingCell.period}限の授業編集
              </h3>
              {editingCell.id && (
                <button 
                  onClick={() => handleDeleteTimetable(editingCell.id!)}
                  className="text-red-400 hover:text-red-300 p-1.5 rounded-full bg-red-500/5 border border-red-500/10"
                  title="この授業を削除"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            <form onSubmit={handleSaveTimetable} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">科目名</label>
                <input 
                  type="text" 
                  required
                  placeholder="例: Java実習"
                  className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#4b88ff]"
                  value={editingCell.subject}
                  onChange={e => setEditingCell({ ...editingCell, subject: e.target.value })}
                />
                <div className="flex flex-wrap gap-1.5 mt-2 max-h-36 overflow-y-auto pr-1">
                  {(() => {
                    const presetList = [
                      'データベーススペシャリスト試験対策',
                      '機械学習と深層学習理論',
                      '機械学習プログラミング',
                      'キャリアデザイン',
                      '開発プロジェクト',
                      '企業連携プロジェクト',
                      'Web制作',
                      'アルゴリズム',
                      'データベース',
                      'プログラミング',
                      '英語',
                      'ゼミ'
                    ];
                    // 時間割にすでに入っている科目も先頭に追加（自動学習）
                    const registeredSubjects = timetable.map(t => t.subject).filter(Boolean);
                    const allUniqueSubjects = Array.from(new Set([...registeredSubjects, ...presetList]));

                    return allUniqueSubjects.map(sub => (
                      <button
                        key={sub}
                        type="button"
                        onClick={() => setEditingCell(prev => prev ? { ...prev, subject: sub } : null)}
                        className={`px-2.5 py-1 text-[10px] rounded-lg border transition-all cursor-pointer ${
                          editingCell?.subject === sub
                            ? 'bg-[#4b88ff]/25 border-[#4b88ff] text-[#93c5fd] font-bold'
                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10 text-[#94a3b8] hover:text-[#f8fafc]'
                        }`}
                      >
                        {sub}
                      </button>
                    ));
                  })()}
                </div>
              </div>

              {/* 授業形態セレクター */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    授業形態 (受講スタイル)
                  </label>
                  {editingCell?.classType && editingCell.classType !== defaultClassType && (
                    <button
                      type="button"
                      onClick={() => handleSetDefaultClassType(editingCell.classType!)}
                      className="text-[9px] text-[#a78bfa] hover:underline cursor-pointer"
                    >
                      ★ これを基本スタイルにする
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { type: 'in_person', label: '🏫 対面', sub: '登校' },
                    { type: 'zoom', label: '💻 Zoom', sub: '配信' },
                    { type: 'ondemand', label: '📺 オンデマンド', sub: '録画' }
                  ].map(opt => {
                    const isSelected = (editingCell?.classType || 'in_person') === opt.type;
                    return (
                      <button
                        key={opt.type}
                        type="button"
                        onClick={() => setEditingCell(prev => prev ? { ...prev, classType: opt.type as ClassType } : null)}
                        className={`py-2 px-1 rounded-xl text-center border transition-all cursor-pointer ${
                          isSelected
                            ? opt.type === 'zoom'
                              ? 'bg-[#8b5cf6]/20 border-[#8b5cf6] text-[#c4b5fd] font-bold shadow-sm shadow-[#8b5cf6]/20'
                              : opt.type === 'ondemand'
                              ? 'bg-[#10b981]/20 border-[#10b981] text-[#6ee7b7] font-bold shadow-sm shadow-[#10b981]/20'
                              : 'bg-[#4b88ff]/20 border-[#4b88ff] text-[#93c5fd] font-bold shadow-sm shadow-[#4b88ff]/20'
                            : 'bg-[#0f1115] border-white/5 text-[#94a3b8] hover:text-[#f8fafc] hover:bg-white/[0.03]'
                        }`}
                      >
                        <div className="text-xs">{opt.label}</div>
                        <div className="text-[9px] opacity-60 mt-0.5">{opt.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 教室名 / Zoom・講義リンク */}
              <div>
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    教室名 または Zoom/講義リンク (任意)
                  </label>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    placeholder={
                      editingCell?.classType === 'zoom'
                        ? '例: https://zoom.us/j/... またはミーティングID'
                        : editingCell?.classType === 'ondemand'
                        ? '例: https://moodle... または講義ポータルURL'
                        : '例: 3号館302教室 / 大講義室'
                    }
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#4b88ff]"
                    value={editingCell?.classroom || ''}
                    onChange={e => setEditingCell(prev => prev ? { ...prev, classroom: e.target.value } : null)}
                  />
                </div>
                <p className="text-[9px] text-[#64748b] mt-1">
                  💡 URLを入力すると、Life OS側からワンタップでZoomや講義ページを直接開けます！
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">開始時間</label>
                    <button
                      type="button"
                      onClick={() => {
                        const def = defaultPeriodTimes[editingCell.period];
                        if (def) setEditingCell({ ...editingCell, startTime: def.startTime, endTime: def.endTime });
                      }}
                      className="text-[9px] text-[#4b88ff] hover:underline cursor-pointer"
                    >
                      標準時間を適用
                    </button>
                  </div>
                  <input 
                    type="time" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#4b88ff]"
                    value={editingCell.startTime}
                    onChange={e => setEditingCell({ ...editingCell, startTime: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">終了時間</label>
                  <input 
                    type="time" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#4b88ff]"
                    value={editingCell.endTime}
                    onChange={e => setEditingCell({ ...editingCell, endTime: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => setEditingCell(null)}
                  className="flex-1 py-2.5 bg-[#1a1d24] text-xs font-bold rounded-xl border border-white/5 text-[#94a3b8] hover:text-[#f8fafc] transition-all"
                >
                  キャンセル
                </button>
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-[#4b88ff] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.98] transition-all"
                >
                  保存する
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK TIMETABLE EDIT MODAL */}
      {isBulkEditOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <h3 className="font-extrabold text-sm text-[#f8fafc]">時間割 一括入力</h3>
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                className="text-[#94a3b8] hover:text-[#f8fafc] p-1 rounded-lg hover:bg-white/5 transition-all text-xs"
              >
                ✕
              </button>
            </div>

            {/* 写真読み取り */}
            <div className="space-y-2 bg-[#0f1115]/60 border border-white/5 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">📷 写真から読み取る（任意）</div>
              <input
                type="file"
                accept="image/*"
                onChange={e => setTimetableImage(e.target.files?.[0] || null)}
                className="w-full text-[10px] text-[#94a3b8] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:bg-white/5 file:text-[10px] file:text-[#f8fafc] cursor-pointer"
              />
              <input
                type="password"
                placeholder="Gemini APIキー（初回のみ・端末内に保存）"
                value={geminiApiKey}
                onChange={e => {
                  setGeminiApiKey(e.target.value);
                  localStorage.setItem('sw_gemini_api_key', e.target.value);
                }}
                className="w-full px-3 py-2 bg-[#0f1115] border border-white/5 rounded-xl text-[10px] text-[#f8fafc] focus:outline-none focus:border-[#4b88ff]"
              />
              <button
                type="button"
                disabled={isReadingTimetable || !timetableImage}
                onClick={handleReadTimetablePhoto}
                className="w-full py-2 bg-[#4b88ff]/15 hover:bg-[#4b88ff]/25 border border-[#4b88ff]/30 text-[#4b88ff] font-bold rounded-xl text-[11px] transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isReadingTimetable ? '読み取り中...' : '写真を読み取ってグリッドに反映'}
              </button>
              {timetableReadError && <p className="text-[10px] text-red-400">{timetableReadError}</p>}
              <p className="text-[9px] text-[#94a3b8]/60 leading-relaxed">
                読み取り後は下のグリッドで確認・修正してから保存できます。APIキーは <a href="https://aistudio.google.com/api-keys" target="_blank" rel="noreferrer" className="text-[#4b88ff] hover:underline">Google AI Studio</a> で無料取得できます（キーはこの端末にのみ保存されます）。
              </p>
            </div>

            {/* テキスト貼り付け */}
            <div className="space-y-2 bg-[#0f1115]/60 border border-white/5 rounded-2xl p-3">
              <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">📋 テキストから貼り付け（任意）</div>
              <textarea
                value={bulkPasteText}
                onChange={e => setBulkPasteText(e.target.value)}
                rows={4}
                placeholder={'月 1 英語\n月 2 数学'}
                className="w-full px-3 py-2 bg-[#0f1115] border border-white/5 rounded-xl text-[10px] text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] font-mono"
              />
              <button
                type="button"
                onClick={applyBulkPasteText}
                className="w-full py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-[#f8fafc] font-bold rounded-xl text-[11px] transition-all"
              >
                テキストをグリッドに反映
              </button>
              <p className="text-[9px] text-[#94a3b8]/60 leading-relaxed">1行に「曜日 限 科目名」の順で（空白・カンマ区切り）。例: 火 3 プログラミング</p>
            </div>

            {/* グリッド直接入力 */}
            <div>
              <div className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider mb-2">✏️ グリッドで直接入力</div>
              <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#1a1d24]">
                <table className="w-full border-collapse text-xs min-w-[320px]">
                  <thead>
                    <tr className="border-b border-white/5 bg-[#0f1115]/40 text-[#94a3b8] font-bold">
                      <th className="py-2 w-10 border-r border-white/5 text-[10px]">限</th>
                      {weekdays.map(day => (
                        <th key={day} className="py-2 border-r border-white/5 last:border-r-0 text-[10px]">{day}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map(period => (
                      <tr key={period} className="border-b border-white/5 last:border-b-0">
                        <td className="py-1 px-1 text-[10px] font-bold text-[#94a3b8] border-r border-white/5 bg-[#0f1115]/20 text-center">{period}限</td>
                        {weekdays.map(day => (
                          <td key={day} className="p-0.5 border-r border-white/5 last:border-r-0">
                            <input
                              type="text"
                              value={bulkCells[`${day}-${period}`] || ''}
                              onChange={e => setBulkCells({ ...bulkCells, [`${day}-${period}`]: e.target.value })}
                              placeholder="—"
                              className="w-full min-w-0 px-1 py-1.5 bg-[#0f1115] border border-white/5 rounded-md text-[10px] text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] text-center"
                            />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[9px] text-[#94a3b8]/60 mt-2">授業時間は標準時間（1限: 09:10〜 など）で登録されます。個別に変えたい場合は保存後にセルをタップして編集できます。</p>
            </div>

            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setIsBulkEditOpen(false)}
                className="flex-1 py-2.5 bg-[#1a1d24] text-xs font-bold rounded-xl border border-white/5 text-[#94a3b8] hover:text-[#f8fafc] transition-all"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleBulkSaveTimetable}
                className="flex-1 py-2.5 bg-[#4b88ff] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.98] transition-all"
              >
                まとめて保存
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SHIFT ADD MODAL */}
      {isAddShiftOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="font-extrabold text-sm text-[#f8fafc]">
              {editingShift ? 'シフトの編集' : '新規シフトの登録'}
            </h3>

            <form onSubmit={handleAddShiftSubmit} className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">店舗名</label>
                <select 
                  className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b] mb-2"
                  value={newShiftStore}
                  onChange={e => setNewShiftStore(e.target.value)}
                >
                  <option value="マック">マック 🍔</option>
                  <option value="ローソン">ローソン 🏪</option>
                  <option value="スタバ">スタバ ☕</option>
                  <option value="その他">その他 💼</option>
                  <option value="カスタム">直接入力する...</option>
                </select>
                {newShiftStore === 'カスタム' && (
                  <input 
                    type="text" 
                    placeholder="店舗名を入力してください" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                    value={newShiftCustomStore}
                    onChange={e => setNewShiftCustomStore(e.target.value)}
                  />
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">日付</label>
                <input 
                  type="date" 
                  required
                  className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                  value={newShiftDate}
                  onChange={e => setNewShiftDate(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">開始時間</label>
                  <input 
                    type="time" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                    value={newShiftStartTime}
                    onChange={e => setNewShiftStartTime(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">終了時間</label>
                  <input 
                    type="time" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                    value={newShiftEndTime}
                    onChange={e => setNewShiftEndTime(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">時給 (円)</label>
                  <input 
                    type="number" 
                    required
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                    value={newShiftWage}
                    onChange={e => setNewShiftWage(Number(e.target.value))}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">休憩時間 (分)</label>
                  <select 
                    className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/5 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#ef8f3b]"
                    value={newShiftBreakMinutes}
                    onChange={e => setNewShiftBreakMinutes(Number(e.target.value))}
                  >
                    <option value={0}>なし (0分)</option>
                    <option value={15}>15分</option>
                    <option value={30}>30分</option>
                    <option value={45}>45分</option>
                    <option value={60}>60分 (1時間)</option>
                    <option value={90}>90分 (1.5時間)</option>
                    <option value={120}>120分 (2時間)</option>
                  </select>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button 
                  type="button"
                  onClick={() => {
                    setIsAddShiftOpen(false);
                    setEditingShift(null);
                  }}
                  className="flex-1 py-2.5 bg-[#1a1d24] text-xs font-bold rounded-xl border border-white/5 text-[#94a3b8] hover:text-[#f8fafc] transition-all"
                >
                  キャンセル
                </button>
                {editingShift && (
                  <button 
                    type="button"
                    onClick={async () => {
                      if (confirm('このシフトを削除しますか？')) {
                        await deleteShift(user.uid, editingShift.id);
                        setIsAddShiftOpen(false);
                        setEditingShift(null);
                      }
                    }}
                    className="py-2.5 px-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-bold rounded-xl text-xs active:scale-[0.98] transition-all"
                  >
                    削除
                  </button>
                )}
                <button 
                  type="submit"
                  className="flex-1 py-2.5 bg-[#ef8f3b] text-white font-bold rounded-xl text-xs shadow-md shadow-[#ef8f3b]/10 active:scale-[0.98] transition-all"
                >
                  {editingShift ? '保存する' : '登録する'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* LIFE OS TIMETABLE SYNC MODAL */}
      {isSchoolSyncPromptOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#1a1d24] border border-white/5 rounded-3xl p-6 shadow-2xl space-y-5">
            <div className="flex justify-between items-center pb-2 border-b border-white/5">
              <div className="flex items-center gap-2">
                <span className="text-base">📅</span>
                <h3 className="font-extrabold text-sm text-[#f8fafc]">
                  時間割をLife OSに登録
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsSchoolSyncPromptOpen(false)}
                className="text-[#94a3b8] hover:text-[#f8fafc] p-1 rounded-lg hover:bg-white/5 transition-all text-xs"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">
                  登録対象の期間を選択
                </label>
                <select
                  className="w-full px-4 py-2.5 bg-[#0f1115] border border-white/10 rounded-xl text-xs text-[#f8fafc] focus:outline-none focus:border-[#4b88ff] transition-all cursor-pointer"
                  value={syncPeriodKey}
                  onChange={e => setSyncPeriodKey(e.target.value as SyncPeriodKey)}
                >
                  {syncPeriodOptions.map(opt => (
                    <option key={opt.key} value={opt.key}>
                      {opt.label} ({opt.rangeText})
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview Box */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-[10px] font-bold text-[#94a3b8] uppercase tracking-wider">
                    登録内容のプレビュー
                  </span>
                  <span className="text-[10px] bg-[#4b88ff]/15 text-[#4b88ff] px-2 py-0.5 rounded-full font-bold border border-[#4b88ff]/20">
                    計 {totalClassesToRegister} コマ
                  </span>
                </div>

                <div className="max-h-56 overflow-y-auto space-y-2 pr-1 border border-white/5 bg-[#0f1115] p-3 rounded-2xl text-xs">
                  {syncPreviewItems.every(p => p.classes.length === 0) ? (
                    <div className="text-center py-6 text-xs text-[#94a3b8]">
                      時間割に登録された授業がありません。<br />
                      先に時間割に授業を追加してください。
                    </div>
                  ) : (
                    syncPreviewItems.map((item, idx) => {
                      if (item.classes.length === 0) return null;
                      return (
                        <div key={idx} className="bg-[#1a1d24] border border-white/5 rounded-xl p-2.5 space-y-1.5">
                          <div className="flex items-center justify-between text-[11px] font-bold text-[#94a3b8]">
                            <span>{item.target.displayDate}</span>
                            <span className="text-[10px] text-white/50">{item.classes.length}コマ</span>
                          </div>
                          <div className="space-y-1">
                            {item.classes.map(c => (
                              <div
                                key={c.id || `${c.day}-${c.period}`}
                                className="flex items-center justify-between bg-white/5 px-2.5 py-1.5 rounded-lg text-xs"
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] bg-[#4b88ff]/20 text-[#4b88ff] px-1.5 py-0.5 rounded font-bold">
                                    {c.period}限
                                  </span>
                                  <span className="font-medium text-[#f8fafc]">{c.subject}</span>
                                </div>
                                <span className="text-[10px] text-[#94a3b8]">{c.startTime} - {c.endTime}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="text-[10px] text-[#94a3b8] bg-[#0f1115]/60 border border-white/5 p-3 rounded-xl leading-relaxed">
                💡 登録すると Life OS のカレンダーに授業予定が追加されます。特定の週に予定がない場合や休講の場合は、登録後に Life OS 側で個別に予定を削除・変更できます。
              </div>

              <div className="flex flex-col gap-2 pt-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={isRegisteringToLifeOs || isDeletingFromLifeOs}
                    onClick={() => setIsSchoolSyncPromptOpen(false)}
                    className="flex-1 py-2.5 bg-[#1a1d24] text-xs font-bold rounded-xl border border-white/5 text-[#94a3b8] hover:text-[#f8fafc] transition-all disabled:opacity-50"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    disabled={isRegisteringToLifeOs || isDeletingFromLifeOs || totalClassesToRegister === 0}
                    onClick={handleRegisterTimetableToLifeOs}
                    className="flex-1 py-2.5 bg-[#4b88ff] hover:bg-[#3b78ef] text-white font-bold rounded-xl text-xs shadow-md shadow-[#4b88ff]/10 active:scale-[0.98] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isRegisteringToLifeOs ? (
                      <span>登録中...</span>
                    ) : (
                      <span>Life OSに登録する ({totalClassesToRegister}コマ)</span>
                    )}
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isRegisteringToLifeOs || isDeletingFromLifeOs || totalClassesToRegister === 0}
                  onClick={handleDeleteTimetableFromLifeOs}
                  className="w-full py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 rounded-xl text-[11px] font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                >
                  {isDeletingFromLifeOs ? (
                    <span>削除中...</span>
                  ) : (
                    <span>🗑️ この期間の授業予定をLife OSから一括削除・取り消す</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
