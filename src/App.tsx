import React, { useState, useEffect } from 'react';
import { useAppStore } from './store/useAppStore';
import type { Shift } from './store/useAppStore';
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
  AlertCircle
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

  // Zustand Store hooks
  const {
    timetable,
    assignments,
    tests,
    shifts,
    initData,
    cleanup,
    saveTimetableCell,
    deleteTimetableCell,
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
  } | null>(null);

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
              href="https://ta1you.github.io/life-os/"
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
            href="https://ta1you.github.io/life-os/"
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
                  <span className="text-[10px] bg-[#4b88ff]/10 text-[#4b88ff] px-2.5 py-1 rounded-full font-bold border border-[#4b88ff]/10">自動Life OS連携</span>
                </div>

                {/* Timetable Grid */}
                <div className="overflow-x-auto border border-white/5 rounded-2xl bg-[#1a1d24]">
                  <table className="w-full border-collapse text-xs text-center min-w-[320px]">
                    <thead>
                      <tr className="border-b border-white/5 bg-[#0f1115]/40 text-[#94a3b8] font-bold">
                        <th className="py-2.5 w-10 border-r border-white/5">限</th>
                        {weekdays.map(day => (
                          <th key={day} className="py-2.5 border-r border-white/5 last:border-r-0">{day}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {periods.map(period => (
                        <tr key={period} className="border-b border-white/5 last:border-b-0">
                          <td className="py-4 font-bold border-r border-white/5 bg-[#0f1115]/20 text-[#94a3b8]">{period}</td>
                          {weekdays.map(day => {
                            const item = findTimetableItem(day, period);
                            return (
                              <td 
                                key={day} 
                                onClick={() => setEditingCell(item ? { ...item } : { day, period, subject: '', startTime: '10:50', endTime: '12:20' })}
                                className="p-1.5 border-r border-white/5 last:border-r-0 cursor-pointer hover:bg-white/[0.02] transition-all"
                              >
                                {item ? (
                                  <div className="bg-[#4b88ff]/10 border border-[#4b88ff]/20 text-[#4b88ff] p-2 rounded-lg font-bold text-[10px] min-h-[56px] flex flex-col justify-center">
                                    <div className="line-clamp-2">{item.subject}</div>
                                    <div className="text-[8px] text-[#4b88ff]/80 font-normal mt-1 flex items-center justify-center gap-0.5">
                                      <Clock className="w-2 h-2" />
                                      {item.startTime}
                                    </div>
                                  </div>
                                ) : (
                                  <div className="border border-dashed border-white/5 hover:border-white/10 text-white/10 hover:text-white/30 p-2 rounded-lg min-h-[56px] flex items-center justify-center transition-all">
                                    <Plus className="w-4 h-4" />
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="text-[10px] text-[#94a3b8] bg-[#1a1d24] border border-white/5 p-4 rounded-xl leading-relaxed">
                  💡 **時間割の使い方**: 空いている時限のマスをクリックすると、授業名と時間を新しく登録できます。登録された授業は、毎週その曜日になると**Life OS側へ自動的に連携・表示**されます。
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
                        <div className="font-bold text-[#34d399]">¥{s.estimatedPay.toLocaleString()}</div>
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
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {['英語', '数学', '国語', 'プログラミング', 'アルゴリズム', 'データベース', 'Web制作', 'ゼミ'].map(sub => (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => setEditingCell({ ...editingCell, subject: sub })}
                      className="px-2 py-1 text-[10px] bg-white/5 border border-white/5 hover:bg-white/10 hover:border-white/10 rounded-lg text-[#94a3b8] hover:text-[#f8fafc] transition-all cursor-pointer"
                    >
                      {sub}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-[#94a3b8] mb-2 uppercase tracking-wider">開始時間</label>
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
    </div>
  );
}

export default App;
