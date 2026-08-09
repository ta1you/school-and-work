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
  updateDoc
} from 'firebase/firestore';

export interface TimetableItem {
  id: string;
  day: string; // '月' | '火' | '水' | '木' | '金'
  period: number; // 1 | 2 | 3 | 4 | 5
  subject: string;
  startTime: string;
  endTime: string;
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
  deleteTimetableCell: (uid: string, id: string) => Promise<void>;
  
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
    if (item.id) {
      const docRef = doc(db, 'school', uid, 'timetable', item.id);
      await setDoc(docRef, {
        day: item.day,
        period: item.period,
        subject: item.subject,
        startTime: item.startTime,
        endTime: item.endTime
      });
    } else {
      const colRef = collection(db, 'school', uid, 'timetable');
      await addDoc(colRef, {
        day: item.day,
        period: item.period,
        subject: item.subject,
        startTime: item.startTime,
        endTime: item.endTime
      });
    }
  },

  deleteTimetableCell: async (uid, id) => {
    await deleteDoc(doc(db, 'school', uid, 'timetable', id));
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

