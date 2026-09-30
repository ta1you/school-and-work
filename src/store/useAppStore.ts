import { create } from 'zustand';
import { db } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  query, 
  doc, 
  setDoc, 
  addDoc, 
  deleteDoc,
  updateDoc,
  writeBatch
} from 'firebase/firestore';

export type ClassType = 'in_person' | 'zoom' | 'ondemand' | 'other';

export interface TimetableItem {
  id: string;
  day: string; // '月' | '火' | '水' | '木' | '金'
  period: number; // 1 | 2 | 3 | 4 | 5
  subject: string;
  startTime: string;
  endTime: string;
  classType?: ClassType; // 'in_person' (対面) | 'zoom' (Zoom) | 'ondemand' (オンデマンド) | 'other' (その他)
  classroom?: string;    // 教室名・Zoom/講義リンク・メモ
}

export interface Assignment {
  id: string;
  title: string;
  dueDate: string;
  completed: boolean;
}

export interface TestItem {
  id: string;
  title: string;
  date: string;
}

export interface Shift {
  id: string;
  store: string;
  startTime: string; // ISO String
  endTime: string; // ISO String
  hourlyWage: number;
  breakMinutes: number;
  workHours: number;
  estimatedPay: number;
}

interface AppState {
  timetable: TimetableItem[];
  assignments: Assignment[];
  tests: TestItem[];
  shifts: Shift[];
  
  loading: boolean;
  unsubscribers: (() => void)[];

  initData: (uid: string) => void;
  cleanup: () => void;

  saveTimetableCell: (uid: string, item: Omit<TimetableItem, 'id'> & { id?: string }) => Promise<void>;
  updateAllTimetableClassType: (uid: string, classType: ClassType) => Promise<number>;
  deleteTimetableCell: (uid: string, id: string) => Promise<void>;
  registerTimetableForDates: (uid: string, timetable: TimetableItem[], targetDates: { day: string; date: Date }[]) => Promise<number>;
  deleteTimetableForDates: (uid: string, timetable: TimetableItem[], targetDates: { day: string; date: Date }[]) => Promise<number>;
  registerTimetableForWeek: (uid: string, timetable: TimetableItem[], weekDates: { day: string; date: Date }[]) => Promise<void>;
  setSchoolSyncEnabled: (uid: string, enabled: boolean) => Promise<void>;
  
  addAssignment: (uid: string, assignment: Omit<Assignment, 'id' | 'completed'>) => Promise<void>;
  toggleAssignment: (uid: string, id: string, completed: boolean) => Promise<void>;
  deleteAssignment: (uid: string, id: string) => Promise<void>;

  addTest: (uid: string, test: Omit<TestItem, 'id'>) => Promise<void>;
  deleteTest: (uid: string, id: string) => Promise<void>;

  addShift: (uid: string, shift: Omit<Shift, 'id' | 'workHours' | 'estimatedPay'>) => Promise<void>;
  updateShift: (uid: string, id: string, shift: Omit<Shift, 'id' | 'workHours' | 'estimatedPay'>) => Promise<void>;
  deleteShift: (uid: string, id: string) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  timetable: [],
  assignments: [],
  tests: [],
  shifts: [],
  loading: true,
  unsubscribers: [],

  initData: (uid: string) => {
    get().cleanup();

    const unsubTimetable = onSnapshot(query(collection(db, 'school', uid, 'timetable')), (snapshot) => {
      const list: TimetableItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as TimetableItem);
      });
      set({ timetable: list });
    });

    const unsubAssignments = onSnapshot(query(collection(db, 'school', uid, 'assignments')), (snapshot) => {
      const list: Assignment[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Assignment);
      });
      set({ assignments: list });
    });

    const unsubTests = onSnapshot(query(collection(db, 'school', uid, 'tests')), (snapshot) => {
      const list: TestItem[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as TestItem);
      });
      set({ tests: list });
    });

    const unsubShifts = onSnapshot(query(collection(db, 'work', uid, 'shifts')), (snapshot) => {
      const list: Shift[] = [];
      snapshot.forEach((doc) => {
        list.push({ id: doc.id, ...doc.data() } as Shift);
      });
      set({ shifts: list, loading: false });
    });

    set({ unsubscribers: [unsubTimetable, unsubAssignments, unsubTests, unsubShifts] });
  },

  cleanup: () => {
    get().unsubscribers.forEach((unsub) => unsub());
    set({ timetable: [], assignments: [], tests: [], shifts: [], unsubscribers: [], loading: true });
  },

  saveTimetableCell: async (uid, item) => {
    const dataToSave = {
      day: item.day,
      period: item.period,
      subject: item.subject,
      startTime: item.startTime,
      endTime: item.endTime,
      classType: item.classType || 'in_person',
      classroom: item.classroom || ''
    };

    if (item.id) {
      const docRef = doc(db, 'school', uid, 'timetable', item.id);
      await setDoc(docRef, dataToSave);
    } else {
      const colRef = collection(db, 'school', uid, 'timetable');
      await addDoc(colRef, dataToSave);
    }
  },

  deleteTimetableCell: async (uid, id) => {
    await deleteDoc(doc(db, 'school', uid, 'timetable', id));
  },

  updateAllTimetableClassType: async (uid, classType) => {
    const timetable = get().timetable;
    if (timetable.length === 0) return 0;
    const batch = writeBatch(db);
    timetable.forEach(item => {
      const docRef = doc(db, 'school', uid, 'timetable', item.id);
      batch.update(docRef, { classType });
    });
    await batch.commit();
    return timetable.length;
  },

  registerTimetableForDates: async (uid, timetable, targetDates) => {
    let count = 0;
    const tasks = targetDates.flatMap(({ day, date }) => {
      const items = timetable.filter(item => item.day === day);
      return items.map(item => {
        count++;
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const scheduleRef = doc(db, 'users', uid, 'schedules', `school-${dateKey}-${item.id}`);
        const classType = item.classType || 'in_person';
        const color = classType === 'zoom' ? '#8b5cf6' : classType === 'ondemand' ? '#10b981' : '#3b82f6';

        return setDoc(scheduleRef, {
          title: `${item.subject} (学校)`,
          timeStart: item.startTime,
          timeEnd: item.endTime,
          color,
          date: date.toISOString(),
          isSchool: true,
          source: 'school-timetable',
          timetableId: item.id,
          registeredDate: dateKey,
          classType,
          classroom: item.classroom || ''
        });
      });
    });
    await Promise.all(tasks);
    return count;
  },

  deleteTimetableForDates: async (uid, timetable, targetDates) => {
    let count = 0;
    const tasks = targetDates.flatMap(({ day, date }) => {
      const items = timetable.filter(item => item.day === day);
      return items.map(item => {
        count++;
        const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        const scheduleRef = doc(db, 'users', uid, 'schedules', `school-${dateKey}-${item.id}`);
        return deleteDoc(scheduleRef);
      });
    });
    await Promise.all(tasks);
    return count;
  },

  registerTimetableForWeek: async (uid, timetable, weekDates) => {
    await get().registerTimetableForDates(uid, timetable, weekDates);
  },

  setSchoolSyncEnabled: async (uid, enabled) => {
    await setDoc(doc(db, 'school', uid, 'settings', 'lifeOsSync'), {
      enabled,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  },

  addAssignment: async (uid, assignment) => {
    const colRef = collection(db, 'school', uid, 'assignments');
    await addDoc(colRef, {
      title: assignment.title,
      dueDate: assignment.dueDate,
      completed: false
    });
  },

  toggleAssignment: async (uid, id, completed) => {
    const docRef = doc(db, 'school', uid, 'assignments', id);
    await updateDoc(docRef, { completed });
  },

  deleteAssignment: async (uid, id) => {
    await deleteDoc(doc(db, 'school', uid, 'assignments', id));
  },

  addTest: async (uid, test) => {
    const colRef = collection(db, 'school', uid, 'tests');
    await addDoc(colRef, {
      title: test.title,
      date: test.date
    });
  },

  deleteTest: async (uid, id) => {
    await deleteDoc(doc(db, 'school', uid, 'tests', id));
  },

  addShift: async (uid, shift) => {
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const diffMs = end.getTime() - start.getTime();
    const breakMs = (shift.breakMinutes || 0) * 60 * 1000;
    const hours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60)); // in hours
    const estPay = Math.floor(hours * shift.hourlyWage);

    const colRef = collection(db, 'work', uid, 'shifts');
    await addDoc(colRef, {
      store: shift.store,
      startTime: shift.startTime,
      endTime: shift.endTime,
      hourlyWage: shift.hourlyWage,
      breakMinutes: shift.breakMinutes || 0,
      workHours: Number(hours.toFixed(2)),
      estimatedPay: estPay
    });
  },

  deleteShift: async (uid, id) => {
    await deleteDoc(doc(db, 'work', uid, 'shifts', id));
  },

  updateShift: async (uid, id, shift) => {
    const start = new Date(shift.startTime);
    const end = new Date(shift.endTime);
    const diffMs = end.getTime() - start.getTime();
    const breakMs = (shift.breakMinutes || 0) * 60 * 1000;
    const hours = Math.max(0, (diffMs - breakMs) / (1000 * 60 * 60)); // in hours
    const estPay = Math.floor(hours * shift.hourlyWage);

    const docRef = doc(db, 'work', uid, 'shifts', id);
    await setDoc(docRef, {
      store: shift.store,
      startTime: shift.startTime,
      endTime: shift.endTime,
      hourlyWage: shift.hourlyWage,
      breakMinutes: shift.breakMinutes || 0,
      workHours: Number(hours.toFixed(2)),
      estimatedPay: estPay
    }, { merge: true });
  }
}));

