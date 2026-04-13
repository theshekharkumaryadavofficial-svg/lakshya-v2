/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { SpeedInsights } from '@vercel/speed-insights/react';
import { UniversalResultBoard } from './components/UniversalResultBoard';
import { 
  Target, 
  Sparkles, 
  BookOpen, 
  Trophy, 
  Clock, 
  ChevronRight, 
  LayoutDashboard, 
  LogOut, 
  Beaker, 
  Calculator, 
  Globe, 
  Languages, 
  Scroll, 
  Timer, 
  FileText, 
  Database, 
  User, 
  BarChart3,
  AlertCircle,
  Plus,
  Trash2,
  Edit,
  Edit2,
  File,
  CheckCircle,
  ChevronLeft,
  Settings,
  Calendar,
  ExternalLink,
  Loader2,
  Send,
  Upload,
  Smartphone,
  XCircle,
  MinusCircle,
  CalendarClock,
  Bell,
  Search,
  Lock,
  Unlock,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import React, { useState, ReactNode, cloneElement, ReactElement, useEffect, Component, ErrorInfo, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { 
  auth, 
  db, 
  storage,
  googleProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  doc, 
  setDoc, 
  getDoc, 
  onSnapshot, 
  collection, 
  query, 
  orderBy, 
  limit, 
  handleFirestoreError,
  OperationType,
  User as FirebaseUser,
  addDoc,
  deleteDoc,
  getDocs,
  where,
  updateDoc,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from './firebase';
import { GoogleGenAI } from "@google/genai";

type AppState = 'loading' | 'login' | 'onboarding' | 'dashboard';

export interface SurveyData {
  class: string;
  targetScore: string;
  studyHours: string;
  username?: string;
  finish?: string;
}

export interface UserProfile extends SurveyData {
  uid: string;
  displayName: string;
  email: string;
  photoURL: string;
  points: number;
  accessCount: number;
  role: 'admin' | 'user';
  createdAt: string;
  streak?: number;
  lastLoginDate?: string;
}

interface Subject {
  id: string;
  name: string;
  icon: string;
  color: string;
  order: number;
  isLocked?: boolean;
}

interface Chapter {
  id: string;
  subjectId: string;
  name: string;
  order: number;
}

interface Material {
  id: string;
  chapterId: string;
  subjectId: string;
  title: string;
  type: 'pdf' | 'note' | 'test';
  url?: string;
  content?: string;
  order: number;
}

class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
          <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full text-center">
            <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Something went wrong</h1>
            <p className="text-gray-600 mb-6">We encountered an unexpected error. Please try refreshing the page.</p>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-blue-600 text-white py-3 rounded-xl font-semibold hover:bg-blue-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
  const [appState, setAppState] = useState<AppState>('loading');
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [surveyData, setSurveyData] = useState<SurveyData>({
    class: '10th',
    targetScore: '450+',
    studyHours: '7 Hours',
  });

  useEffect(() => {
    let profileUnsubscribe: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous profile listener if it exists
      if (profileUnsubscribe) {
        profileUnsubscribe();
        profileUnsubscribe = null;
      }

      if (firebaseUser) {
        setUser(firebaseUser);
        
        // Use onSnapshot for real-time profile updates
        profileUnsubscribe = onSnapshot(doc(db, 'users', firebaseUser.uid), (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
            setAppState('dashboard');
          } else {
            setAppState('onboarding');
          }
        }, (error) => {
          handleFirestoreError(error, OperationType.GET, `users/${firebaseUser.uid}`);
        });
      } else {
        setUser(null);
        setProfile(null);
        setAppState('login');
      }
    });

    return () => {
      unsubscribe();
      if (profileUnsubscribe) {
        profileUnsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (profile && profile.uid) {
      const today = new Date().toDateString();
      const lastLogin = profile.lastLoginDate;
      const currentStreak = profile.streak || 0;

      if (lastLogin !== today) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayString = yesterday.toDateString();

        let newStreak = 1;
        if (lastLogin === yesterdayString) {
          newStreak = currentStreak + 1;
        }

        updateDoc(doc(db, 'users', profile.uid), {
          lastLoginDate: today,
          streak: newStreak
        }).catch(e => console.error("Streak update failed", e));
      }
    }
  }, [profile?.uid]);

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error: any) {
      console.error("Login failed", error);
      if (error.code === 'auth/unauthorized-domain') {
        alert("❌ Error: Ye domain (Vercel) Firebase mein authorized nahi hai. Kripya Firebase Console mein jaakar ise 'Authorized Domains' mein add karein.");
      } else if (error.code === 'auth/popup-blocked') {
        alert("❌ Error: Browser ne popup block kar diya hai. Kripya popup allow karein.");
      } else {
        alert("❌ Login failed: " + error.message);
      }
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      setAppState('login');
      setOnboardingStep(1);
    } catch (error) {
      console.error("Logout failed", error);
    }
  };

  const handleSurveySelection = async (key: keyof SurveyData, value: string) => {
    let updatedData = { ...surveyData };
    
    if (key === 'username') {
      updatedData.username = value;
      setSurveyData(updatedData);
      setSelectedOption(value);
      return;
    }

    if (key === 'finish') {
      // Save to Firestore
      if (!user) return;
      
      // Check username uniqueness
      const usernameQuery = query(collection(db, 'users'), where('username', '==', updatedData.username));
      const usernameSnap = await getDocs(usernameQuery);
      if (!usernameSnap.empty) {
        alert("Tag is taken, Topper!");
        return;
      }

      const newProfile: UserProfile = {
        uid: user.uid,
        displayName: user.displayName || 'Topper',
        email: user.email || '',
        photoURL: user.photoURL || '',
        ...updatedData,
        points: 0,
        accessCount: 0,
        role: user.email === 'the.shekharkumaryadavofficial@gmail.com' ? 'admin' : 'user',
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), newProfile);
        setProfile(newProfile);
        setAppState('dashboard');
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `Users/${user.uid}`);
      }
      return;
    }

    setSelectedOption(value);
    
    setTimeout(async () => {
      const updatedData = { ...surveyData, [key]: value };
      setSurveyData(updatedData);
      setSelectedOption(null);
      
      if (onboardingStep < 3) {
        setOnboardingStep(prev => prev + 1);
      } else {
        // Transition to Username Setup
        setOnboardingStep(4);
      }
    }, 400);
  };

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0d0d12] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-cyan-500/20 border-t-cyan-500 rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="relative min-h-screen w-full bg-[#0d0d12] text-white overflow-x-hidden font-sans selection:bg-cyan-500/30">
      {/* Background Blobs */}
      <div className="fixed top-[-10%] left-[-10%] w-[70%] h-[70%] bg-cyan-500/5 blur-[120px] rounded-full pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-600/5 blur-[120px] rounded-full pointer-events-none" />

      <AnimatePresence mode="wait">
        {appState === 'login' && (
          <LoginScreen key="login" onLogin={handleGoogleLogin} />
        )}

        {appState === 'onboarding' && (
          <OnboardingFlow 
            key="onboarding"
            step={onboardingStep} 
            selectedOption={selectedOption}
            onSelect={handleSurveySelection}
            displayName={user?.displayName}
          />
        )}

        {appState === 'dashboard' && profile && (
          <Dashboard key="dashboard" profile={profile} onLogout={handleLogout} />
        )}
      </AnimatePresence>

      {/* Grid Pattern Overlay */}
      <div className="fixed inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
      
      {/* Vercel Speed Insights */}
      <SpeedInsights />
    </div>
  );
}

function LoginScreen({ onLogin }: { onLogin: () => void; key?: string }) {
  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.5 }}
      className="relative z-10 flex items-center justify-center min-h-screen w-full px-6"
    >
      <div className="backdrop-blur-xl bg-white/[0.03] border border-white/[0.08] rounded-[2.5rem] p-8 md:p-12 shadow-2xl flex flex-col items-center text-center w-full max-w-md">
        <motion.div 
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-20 h-20 bg-gradient-to-br from-cyan-400 to-purple-500 rounded-2xl flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(34,211,238,0.3)]"
        >
          <Target className="w-10 h-10 text-white" />
        </motion.div>

        <div className="space-y-2 mb-12">
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight">
            Lakshya <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">AI</span>
          </h1>
          <p className="text-white/50 font-medium tracking-widest text-xs uppercase">
            BSEB Matric AI Tutor
          </p>
        </div>

        <button
          onClick={onLogin}
          className="group relative w-full flex items-center justify-center gap-4 bg-white/[0.05] hover:bg-white/[0.08] border border-white/10 rounded-2xl py-4 px-6 transition-all duration-300 active:scale-[0.98] shadow-[0_10px_40px_-10px_rgba(34,197,94,0.4)] hover:shadow-[0_15px_50px_-5px_rgba(34,197,94,0.5)]"
        >
          <svg className="w-6 h-6" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
          </svg>
          <span className="text-white font-semibold tracking-wide">Continue with Google</span>
        </button>

        <div className="mt-10 text-white/30 text-[10px] uppercase tracking-[0.2em]">
          Secure Access • Student Portal
        </div>
      </div>
    </motion.div>
  );
}

function OnboardingFlow({ 
  step, 
  selectedOption, 
  onSelect,
  displayName
}: { 
  step: number; 
  selectedOption: string | null;
  onSelect: (key: keyof SurveyData, value: string) => void;
  displayName: string | null | undefined;
  key?: string;
}) {
  return (
    <motion.div 
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -50 }}
      transition={{ duration: 0.5, ease: "easeInOut" }}
      className="relative z-10 flex flex-col items-center justify-center min-h-screen w-full px-6"
    >
      <div className="w-full max-w-lg">
        {/* Progress Bar */}
        <div className="w-full h-1.5 bg-white/5 rounded-full mb-12 overflow-hidden">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${(step / 4) * 100}%` }}
            className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 shadow-[0_0_10px_rgba(34,211,238,0.5)]"
          />
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div 
              key="step1"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                Aap kaunsi class ke <span className="text-cyan-400">topper</span> banna chahte hain?
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <SurveyOption 
                  label="🎯 10th (Matric)" 
                  isSelected={selectedOption === '10th'}
                  onClick={() => onSelect('class', '10th')} 
                  large
                />
                <SurveyOption 
                  label="🚀 12th (Inter)" 
                  isSelected={selectedOption === '12th'}
                  onClick={() => onSelect('class', '12th')} 
                  large
                />
              </div>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div 
              key="step2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                Aap kitna <span className="text-purple-400">score</span> karna chahte hain?
              </h2>
              <div className="grid grid-cols-1 gap-4">
                <SurveyOption 
                  label="300 (minimum)" 
                  isSelected={selectedOption === '300'}
                  onClick={() => onSelect('targetScore', '300')} 
                />
                <SurveyOption 
                  label="350 - 400 (average)" 
                  isSelected={selectedOption === '350-400'}
                  onClick={() => onSelect('targetScore', '350-400')} 
                />
                <SurveyOption 
                  label="400 - 450 (maximum)" 
                  isSelected={selectedOption === '400-450'}
                  onClick={() => onSelect('targetScore', '400-450')} 
                />
                <SurveyOption 
                  label="450+ (Hey, Smart! 🔥)" 
                  isSelected={selectedOption === '450+'}
                  onClick={() => onSelect('targetScore', '450+')} 
                  special
                />
              </div>
            </motion.div>
          )}

          {step === 3 && (
            <motion.div 
              key="step3"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <h2 className="text-2xl md:text-3xl font-bold text-center mb-10">
                Aap din me kitne <span className="text-emerald-400">ghante</span> padhte hain?
              </h2>
              <div className="grid grid-cols-1 gap-3">
                {['4 Hours', '7 Hours', '9 Hours', '12 Hours', '12+ Hours 🔥'].map((hours) => (
                  <div key={hours}>
                    <SurveyOption 
                      label={hours} 
                      isSelected={selectedOption === hours}
                      onClick={() => onSelect('studyHours', hours)} 
                    />
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {step === 4 && (
            <UsernameSetup 
              key="step4"
              displayName={displayName || 'Topper'}
              onSave={(username) => onSelect('username', username)}
              onFinish={() => onSelect('finish', 'true')}
            />
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function UsernameSetup({ displayName, onSave, onFinish }: { displayName: string, onSave: (u: string) => void, onFinish: () => void }) {
  const [username, setUsername] = useState(displayName.toLowerCase().replace(/\s+/g, '_'));

  useEffect(() => {
    onSave(username);
  }, [username]);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="space-y-6 text-center"
    >
      <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
        Choose Your <span className="text-cyan-400">Vault Tag</span>
      </h2>
      <div className="relative w-full max-w-sm mx-auto">
        <div className="absolute left-4 top-3 text-white/40 font-bold">@</div>
        <input 
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g., smart_topper"
          className="w-full bg-white/5 border border-white/10 rounded-2xl px-10 py-3 text-lg font-bold outline-none focus:border-cyan-500/50"
        />
      </div>
      <p className="text-xs text-white/40 font-bold uppercase tracking-widest">Checking availability...</p>
      <button 
        onClick={onFinish}
        className="w-full max-w-sm mx-auto bg-green-500 text-black font-black py-4 rounded-2xl text-lg shadow-[0_0_20px_rgba(34,197,94,0.4)] hover:shadow-[0_0_30px_rgba(34,197,94,0.6)] transition-all"
      >
        Save & Start Journey 🚀
      </button>
    </motion.div>
  );
}

function SurveyOption({ 
  label, 
  onClick, 
  isSelected,
  large = false, 
  special = false 
}: { 
  label: string; 
  onClick: () => void; 
  isSelected: boolean;
  large?: boolean; 
  special?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        relative w-full text-left transition-all duration-300 active:scale-[0.98]
        backdrop-blur-xl border rounded-2xl overflow-hidden
        ${large ? 'p-8 md:p-10 text-xl' : 'p-5 text-lg'}
        ${isSelected 
          ? 'bg-cyan-500/20 border-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.4)]' 
          : 'bg-white/[0.03] border-white/[0.08] hover:bg-white/[0.06] hover:border-white/20'
        }
        ${special && !isSelected ? 'border-purple-500/50' : ''}
      `}
    >
      <span className={`
        font-semibold tracking-wide
        ${special ? 'bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-400' : 'text-white'}
      `}>
        {label}
      </span>
      
      {isSelected && (
        <motion.div 
          layoutId="glow"
          className="absolute inset-0 bg-cyan-400/10 pointer-events-none"
        />
      )}
    </button>
  );
}

function Dashboard({ profile, onLogout }: { profile: UserProfile; onLogout: () => void; key?: string }) {
  const [activeTab, setActiveTab] = useState('home');
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [isLakshyaOpen, setIsLakshyaOpen] = useState(false);

  const isAdmin = profile.role === 'admin' || profile.email === 'the.shekharkumaryadavofficial@gmail.com';

  const handleAccessMaterial = async (material: Material) => {
    if (isAdmin) {
      setSelectedMaterial(material);
      return;
    }

    try {
      const userRef = doc(db, 'users', profile.uid);
      await setDoc(userRef, { 
        accessCount: (profile.accessCount || 0) + 1 
      }, { merge: true });
      setSelectedMaterial(material);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${profile.uid}`);
    }
  };

  const handleResetAllData = async () => {
    setIsResetting(true);
    setShowResetConfirm(false);
    
    try {
      console.log("Starting bulk delete...");
      const subjectsSnap = await getDocs(collection(db, 'subjects'));
      console.log(`Found ${subjectsSnap.size} subjects to delete.`);
      
      for (const subjectDoc of subjectsSnap.docs) {
        console.log(`Deleting subject: ${subjectDoc.id}`);
        // Delete chapters subcollection
        const chaptersSnap = await getDocs(collection(db, `subjects/${subjectDoc.id}/chapters`));
        for (const chapterDoc of chaptersSnap.docs) {
          // Delete materials subcollection
          const materialsSnap = await getDocs(collection(db, `subjects/${subjectDoc.id}/chapters/${chapterDoc.id}/materials`));
          for (const materialDoc of materialsSnap.docs) {
            await deleteDoc(doc(db, `subjects/${subjectDoc.id}/chapters/${chapterDoc.id}/materials`, materialDoc.id));
          }
          await deleteDoc(doc(db, `subjects/${subjectDoc.id}/chapters`, chapterDoc.id));
        }
        await deleteDoc(doc(db, 'subjects', subjectDoc.id));
      }
      
      // Also delete test rankings
      const rankingsSnap = await getDocs(collection(db, 'test_rankings'));
      for (const rankingDoc of rankingsSnap.docs) {
        await deleteDoc(doc(db, 'test_rankings', rankingDoc.id));
      }

      // Fallback: Delete chapters and materials if they exist as top-level collections
      const topChaptersSnap = await getDocs(collection(db, 'chapters'));
      for (const chapterDoc of topChaptersSnap.docs) {
        await deleteDoc(doc(db, 'chapters', chapterDoc.id));
      }
      const topMaterialsSnap = await getDocs(collection(db, 'materials'));
      for (const materialDoc of topMaterialsSnap.docs) {
        await deleteDoc(doc(db, 'materials', materialDoc.id));
      }
      
      console.log("Bulk delete completed successfully.");
      setIsResetting(false);
      alert("Data reset successful! All subjects, chapters, and materials have been deleted.");
    } catch (error) {
      console.error("Bulk delete failed:", error);
      setIsResetting(false);
      handleFirestoreError(error, OperationType.DELETE, 'subjects');
    }
  };

  return (
    <div className="relative min-h-screen w-full flex flex-col pb-32">
      {/* TOP APP BAR */}
      <header className="sticky top-0 z-50 p-5 flex items-center justify-between backdrop-blur-xl bg-black/60 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 p-[2px] shadow-[0_0_15_rgba(34,211,238,0.3)]">
            <div className="w-full h-full rounded-full bg-[#0d0d12] flex items-center justify-center overflow-hidden">
              {profile.photoURL ? (
                <img src={profile.photoURL || null} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              ) : (
                <User className="w-6 h-6 text-white/80" />
              )}
            </div>
          </div>
          <div>
            <h2 className="text-sm font-bold text-white leading-tight">Hello, {profile.displayName.split(' ')[0]}! 🎯</h2>
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
              <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold">Bihar Board {profile.class}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex backdrop-blur-xl bg-white/5 border border-white/10 rounded-full px-4 py-1.5 items-center gap-2">
            <span className="text-[10px] font-bold text-white/80 whitespace-nowrap uppercase tracking-tighter">
              Tokens: {profile.accessCount || 0}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTENT (SCROLLABLE) */}
      <main className="flex-1 w-full max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          {selectedMaterial ? (
            <motion.div 
              key="material-view"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.05 }}
              className="p-6"
            >
              <MaterialView material={selectedMaterial} onClose={() => setSelectedMaterial(null)} />
            </motion.div>
          ) : (
            <>
              {activeTab === 'home' && (
                <motion.div key="home">
                  <HomeTab profile={profile} onAccessMaterial={handleAccessMaterial} isAdmin={isAdmin} />
                </motion.div>
              )}
              {activeTab === 'tests' && (
                <motion.div key="tests">
                  <TestTab profile={profile} onAccessMaterial={handleAccessMaterial} isAdmin={isAdmin} />
                </motion.div>
              )}
              {activeTab === 'lakshya' && (
                <motion.div key="lakshya">
                  <LakshyaTab profile={profile} />
                </motion.div>
              )}
              {activeTab === 'study' && (
                <motion.div key="study">
                  <StudyPlanner profile={profile} />
                </motion.div>
              )}
              {activeTab === 'profile' && (
                <motion.div key="profile">
                  <ProfileTab 
                    profile={profile} 
                    onLogout={onLogout} 
                    isAdmin={isAdmin} 
                    onResetData={() => setShowResetConfirm(true)} 
                    isResetting={isResetting}
                    onAdminClick={() => setActiveTab('admin')}
                  />
                </motion.div>
              )}
              {activeTab === 'admin' && isAdmin && (
                <motion.div key="admin">
                  <AdminDashboard onBack={() => setActiveTab('profile')} />
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>
      </main>

      {/* FLOATING BOTTOM NAVIGATION BAR */}
      <nav className="fixed bottom-6 left-6 right-6 z-50">
        <div className="backdrop-blur-3xl bg-black/40 border border-white/10 rounded-3xl p-2 shadow-[0_25px_60px_rgba(0,0,0,0.8)] flex items-center justify-between">
          <NavButton 
            icon={<LayoutDashboard />} 
            label="Home" 
            active={activeTab === 'home'} 
            onClick={() => setActiveTab('home')} 
          />
          <NavButton 
            icon={<Trophy />} 
            label="Tests" 
            active={activeTab === 'tests'} 
            onClick={() => setActiveTab('tests')} 
          />
          
          {/* LAKSHYA CENTER BUTTON */}
          <button 
            onClick={() => setActiveTab('lakshya')}
            className={`relative -top-8 w-16 h-16 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl group ${
              activeTab === 'lakshya' 
                ? 'bg-gradient-to-tr from-cyan-500 via-purple-500 to-pink-500 scale-110 shadow-cyan-500/40' 
                : 'bg-white/10 hover:bg-white/20 border border-white/10'
            }`}
          >
            <Sparkles className={`w-7 h-7 ${activeTab === 'lakshya' ? 'text-white animate-pulse' : 'text-white/60 group-hover:text-white'}`} />
            {activeTab === 'lakshya' && (
              <motion.div 
                layoutId="nav-glow"
                className="absolute inset-0 rounded-full bg-cyan-400/20 blur-2xl"
              />
            )}
          </button>

          <NavButton 
            icon={<CalendarClock />} 
            label="Study" 
            active={activeTab === 'study'} 
            onClick={() => setActiveTab('study')} 
          />
          <NavButton 
            icon={<User />} 
            label="Profile" 
            active={activeTab === 'profile'} 
            onClick={() => setActiveTab('profile')} 
          />
        </div>
      </nav>

      <style>{`
        @keyframes gradient-x {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        .animate-gradient-x {
          background-size: 200% 200%;
          animation: gradient-x 3s ease infinite;
        }
      `}</style>

      {/* RESET CONFIRMATION MODAL */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowResetConfirm(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-[#15151e] border border-white/10 rounded-[2.5rem] p-8 space-y-6 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-2xl flex items-center justify-center border border-red-500/20 mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500" />
              </div>
              <div className="text-center space-y-2">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter">Are you sure?</h3>
                <p className="text-xs text-white/40 leading-relaxed">This will permanently delete ALL subjects, chapters, and materials. This action cannot be undone.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <button 
                  onClick={() => setShowResetConfirm(false)}
                  className="py-4 bg-white/5 hover:bg-white/10 text-white/60 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleResetAllData}
                  className="py-4 bg-red-500 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl shadow-[0_10px_20px_rgba(239,68,68,0.3)] hover:bg-red-600 transition-all"
                >
                  Yes, Delete All
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isResetting && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
            <div className="text-center space-y-4">
              <motion.div 
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-12 h-12 border-4 border-red-500/20 border-t-red-500 rounded-full mx-auto"
              />
              <p className="text-xs font-black text-white uppercase tracking-[0.3em] animate-pulse">Resetting Data...</p>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function LakshyaTab({ profile }: { profile: UserProfile | null }) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<{ id: string; role: 'user' | 'ai'; text: string; timestamp: number }[]>(() => {
    const cached = localStorage.getItem('lakshya_chats');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  useEffect(() => {
    if (!profile?.uid) return;

    const chatRef = doc(db, 'users', profile.uid, 'chatHistory', 'main');
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.messages) {
          setMessages(data.messages);
          localStorage.setItem('lakshya_chats', JSON.stringify(data.messages));
        }
      }
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const quickActions = [
    { label: "Syllabus 📚", prompt: "Bihar Board Class 10th ka updated syllabus kya hai?" },
    { label: "Imp Questions 📝", prompt: "Class 10th Science ke important questions batao." },
    { label: "Time Table ⏰", prompt: "Board exam ke liye best study time table kya hona chahiye?" },
    { label: "Math Tricks 🔢", prompt: "Trigonometry yaad karne ki koi short trick batao." },
  ];

  const handleSend = async (customPrompt?: string) => {
    const userMessageText = customPrompt || input.trim();
    if (!userMessageText || loading || !profile?.uid) return;

    if (!customPrompt) setInput('');
    
    const userMessage = {
      id: Date.now().toString(),
      role: 'user' as const,
      text: userMessageText,
      timestamp: Date.now()
    };

    const newMessages = [...messages, userMessage];
    
    // Optimistic update
    setMessages(newMessages);
    localStorage.setItem('lakshya_chats', JSON.stringify(newMessages));
    
    // Update Firebase
    const chatRef = doc(db, 'users', profile.uid, 'chatHistory', 'main');
    try {
      await setDoc(chatRef, { messages: newMessages }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/chatHistory/main`);
    }

    setLoading(true);

    try {
      const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
      
      if (!apiKey) {
        throw new Error("Gemini API Key is missing. Please configure VITE_GEMINI_API_KEY in Vercel environment variables.");
      }

      const ai = new GoogleGenAI({ apiKey });
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: userMessageText,
        config: {
          systemInstruction: "You are Lakshya (लक्ष्य), a helpful AI assistant for Bihar Board students. Always respond in Hindi (हिंदी). Keep answers concise and accurate. Use bullet points and bold text for readability. If the user asks to generate an image, visualize a scene, or convert a page to a computer text file/image, you can provide a link to Pollinations.ai using the format: https://pollinations.ai/p/[prompt]?width=1024&height=1024&seed=42. For example, if they want a photo of a computer, suggest https://pollinations.ai/p/computer?width=1024&height=1024.",
        }
      });
      
      const aiText = response.text || "क्षमा करें, मैं उत्तर नहीं दे सका।";
      const aiMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai' as const,
        text: aiText,
        timestamp: Date.now()
      };

      const finalMessages = [...newMessages, aiMessage];
      setMessages(finalMessages);
      localStorage.setItem('lakshya_chats', JSON.stringify(finalMessages));
      await setDoc(chatRef, { messages: finalMessages }, { merge: true });

    } catch (error) {
      console.error("Lakshya Error:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        role: 'ai' as const,
        text: "Error connecting to Lakshya AI. Please check your connection.",
        timestamp: Date.now()
      };
      const errorMessages = [...newMessages, errorMessage];
      setMessages(errorMessages);
      localStorage.setItem('lakshya_chats', JSON.stringify(errorMessages));
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    if (!profile?.uid) return;
    if (window.confirm("Are you sure you want to clear all chat history?")) {
      setMessages([]);
      localStorage.removeItem('lakshya_chats');
      const chatRef = doc(db, 'users', profile.uid, 'chatHistory', 'main');
      try {
        await setDoc(chatRef, { messages: [] }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/chatHistory/main`);
      }
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-4 md:p-6 h-[calc(100vh-180px)] flex flex-col relative"
    >
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div className="flex flex-col">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-cyan-500/10 border border-cyan-500/20 rounded-full w-fit">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Lakshya AI Assistant</span>
          </div>
          <p className="text-[8px] text-white/30 uppercase tracking-[0.2em] font-bold mt-1 ml-1">Your Personal Bihar Board Tutor</p>
        </div>
        
        <button 
          onClick={clearHistory}
          className="p-2 bg-white/5 hover:bg-red-500/10 border border-white/10 rounded-xl text-white/40 hover:text-red-500 transition-all group"
          title="Clear Chat History"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto space-y-6 mb-4 pr-2 custom-scrollbar"
      >
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-cyan-500 blur-3xl opacity-20 animate-pulse" />
              <div className="relative w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center border border-white/10 shadow-2xl">
                <Target className="w-12 h-12 text-cyan-400" />
              </div>
            </div>
            
            <div className="space-y-2 max-w-xs mx-auto">
              <h3 className="text-lg font-black text-white uppercase tracking-tight">Namaste! I am Lakshya</h3>
              <p className="text-xs text-white/40 leading-relaxed">Main aapki Bihar Board Matric exam ki taiyari mein madad kar sakta hoon. Kuch bhi poochiye!</p>
            </div>

            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleSend(action.prompt)}
                  className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl text-[10px] font-bold text-white/60 hover:text-white transition-all text-left"
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}
        
        {messages.map((msg) => (
          <motion.div 
            key={msg.id}
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} items-end gap-2`}
          >
            {msg.role === 'ai' && (
              <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mb-1">
                <Target className="w-4 h-4 text-cyan-400" />
              </div>
            )}
            <div className={`max-w-[85%] p-4 rounded-3xl text-sm shadow-xl ${
              msg.role === 'user' 
                ? 'bg-cyan-500/20 border border-cyan-500/30 text-white font-medium rounded-br-none shadow-[0_0_20px_rgba(34,211,238,0.1)]' 
                : 'bg-[#1a1a24] border border-white/10 text-white/90 rounded-tl-none'
            }`}>
              <div className="markdown-body prose prose-invert prose-sm max-w-none">
                <ReactMarkdown>{msg.text}</ReactMarkdown>
              </div>
              <p className="text-[8px] opacity-30 mt-2 text-right">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>
          </motion.div>
        ))}
        
        {loading && (
          <div className="flex justify-start items-end gap-2">
            <div className="w-8 h-8 rounded-full bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center shrink-0 mb-1">
              <Target className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="bg-[#1a1a24] border border-white/10 p-4 rounded-3xl rounded-tl-none flex items-center gap-3">
              <div className="flex gap-1">
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6 }} className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.2 }} className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
                <motion.div animate={{ scale: [1, 1.5, 1] }} transition={{ repeat: Infinity, duration: 0.6, delay: 0.4 }} className="w-1.5 h-1.5 bg-cyan-400 rounded-full" />
              </div>
              <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest animate-pulse">Lakshya is thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="relative group">
        <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-[2rem] blur opacity-20 group-focus-within:opacity-40 transition-all" />
        <div className="relative flex items-center gap-2 bg-[#1a1a24] border border-white/10 rounded-[2rem] p-2 pr-3">
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ask Lakshya AI..."
            className="flex-1 bg-transparent px-4 py-3 text-sm text-white outline-none placeholder:text-white/20"
          />
          <button 
            onClick={() => handleSend()}
            disabled={loading || !input.trim()}
            className="w-12 h-12 bg-cyan-500 text-black rounded-2xl flex items-center justify-center hover:bg-cyan-400 transition-all disabled:opacity-50 active:scale-95 shadow-lg shadow-cyan-500/20"
          >
            <Send className="w-5 h-5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

function HomeTab({ profile, onAccessMaterial, isAdmin }: { profile: UserProfile; onAccessMaterial: (m: Material) => void; isAdmin: boolean }) {
  const [homeSubjects, setHomeSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);

  // New features state
  const [onlineCount, setOnlineCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  // Admin states
  const [isAddingSubject, setIsAddingSubject] = useState(false);
  const [newSubjectName, setNewSubjectName] = useState('');
  const [isAddingChapter, setIsAddingChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState('');
  const [isAddingMaterial, setIsAddingMaterial] = useState(false);
  const [newMaterialTitle, setNewMaterialTitle] = useState('');
  const [newMaterialType, setNewMaterialType] = useState<'pdf' | 'note' | 'test'>('pdf');
  const [newMaterialUrl, setNewMaterialUrl] = useState('');
  const [newMaterialContent, setNewMaterialContent] = useState('');
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'subjects'), orderBy('order')), (snap) => {
      setHomeSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'subjects');
    });
    return () => unsubscribe();
  }, []);

  // Real-time Online Toppers Listener
  useEffect(() => {
    if (!profile?.uid) return;
    const userRef = doc(db, 'users', profile.uid);
    updateDoc(userRef, { isOnline: true, lastActive: new Date().toISOString() }).catch(() => {});

    const q = query(collection(db, 'users'), where('isOnline', '==', true));
    const unsubscribe = onSnapshot(q, (snap) => {
      setOnlineCount(snap.size);
    }, (error) => {
      console.error("Error fetching online users:", error);
    });

    return () => {
      updateDoc(userRef, { isOnline: false }).catch(() => {});
      unsubscribe();
    };
  }, [profile?.uid]);

  // Real Quick Search
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setIsSearching(true);
    const search = async () => {
      try {
        const qStr = searchQuery.charAt(0).toUpperCase() + searchQuery.slice(1);
        const qSubj = query(collection(db, 'subjects'), where('name', '>=', qStr), where('name', '<=', qStr + '\uf8ff'));
        const resSubj = await getDocs(qSubj);
        
        const results = resSubj.docs.map(d => ({ id: d.id, name: d.data().name, type: 'subject' as const, data: d.data() }));
        setSearchResults(results);
      } catch (e) {
        console.error(e);
      } finally {
        setIsSearching(false);
      }
    };
    
    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  useEffect(() => {
    if (selectedSubject) {
      const q = query(collection(db, `subjects/${selectedSubject.id}/chapters`), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setChapters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `subjects/${selectedSubject.id}/chapters`);
      });
      return () => unsubscribe();
    } else {
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject && selectedChapter) {
      const q = query(collection(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`);
      });
      return () => unsubscribe();
    } else {
      setMaterials([]);
    }
  }, [selectedSubject, selectedChapter]);

  const handleAddSubject = async () => {
    if (!newSubjectName) return;
    try {
      await addDoc(collection(db, 'subjects'), {
        name: newSubjectName,
        order: homeSubjects.length,
        icon: 'BookOpen',
        color: 'cyan'
      });
      setNewSubjectName('');
      setIsAddingSubject(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'subjects');
    }
  };

  const handleDeleteSubject = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this subject?")) {
      try {
        await deleteDoc(doc(db, 'subjects', id));
        setHomeSubjects(prev => prev.filter(s => s.id !== id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `subjects/${id}`);
      }
    }
  };

  const handleAddChapter = async () => {
    if (!newChapterName || !selectedSubject) return;
    try {
      await addDoc(collection(db, `subjects/${selectedSubject.id}/chapters`), {
        name: newChapterName,
        subjectId: selectedSubject.id,
        order: chapters.length
      });
      setNewChapterName('');
      setIsAddingChapter(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `subjects/${selectedSubject.id}/chapters`);
    }
  };

  const handleDeleteChapter = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!selectedSubject) return;
    if (confirm("Are you sure you want to delete this chapter?")) {
      try {
        await deleteDoc(doc(db, `subjects/${selectedSubject.id}/chapters`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `subjects/${selectedSubject.id}/chapters/${id}`);
      }
    }
  };

  const handleAddMaterial = async () => {
    if (!newMaterialTitle || !selectedSubject || !selectedChapter) return;
    setUploading(true);
    try {
      let finalUrl = newMaterialUrl;

      if (newMaterialType === 'pdf' && selectedFile) {
        const storageRef = ref(storage, `materials/${selectedSubject.id}/${selectedChapter.id}/${Date.now()}_${selectedFile.name}`);
        const snapshot = await uploadBytes(storageRef, selectedFile);
        finalUrl = await getDownloadURL(snapshot.ref);
      }

      await addDoc(collection(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`), {
        title: newMaterialTitle,
        type: newMaterialType,
        url: finalUrl,
        content: newMaterialContent,
        chapterId: selectedChapter.id,
        subjectId: selectedSubject.id,
        order: materials.length
      });
      setNewMaterialTitle('');
      setNewMaterialUrl('');
      setNewMaterialContent('');
      setSelectedFile(null);
      setIsAddingMaterial(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteMaterial = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!selectedSubject || !selectedChapter) return;
    if (confirm("Are you sure you want to delete this material?")) {
      try {
        await deleteDoc(doc(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials/${id}`);
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 space-y-8"
    >
      {/* HEADER SECTION */}
      {!selectedSubject && (
        <div className="flex flex-col sm:flex-row items-stretch gap-4">
          {/* REAL-TIME TOPPERS CARD */}
          <div className="flex-1 p-4 bg-cyan-900/20 border border-cyan-500/30 rounded-[2rem] backdrop-blur-xl shadow-[0_0_20px_rgba(34,211,238,0.1)] flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-cyan-500"></span>
              </div>
              <h3 className="text-sm font-black text-cyan-400 uppercase tracking-widest">Real-Time Toppers</h3>
            </div>
            <div className="text-2xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
              {onlineCount} <span className="text-xs text-white/50">Online</span>
            </div>
          </div>

          {/* REAL QUICK SEARCH */}
          <div className="flex-1 relative z-50">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-white/40" />
              <input 
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search subjects..."
                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-sm font-bold text-white outline-none focus:border-cyan-500/50 transition-all placeholder:text-white/20"
              />
              {isSearching && (
                <Loader2 className="absolute right-4 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
              )}
            </div>

            <AnimatePresence>
              {searchQuery.trim() && searchResults.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d12]/95 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                >
                  {searchResults.map((res) => (
                    <button 
                      key={res.id}
                      onClick={() => {
                        setSelectedSubject(res.data);
                        setSearchQuery('');
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-white/5 transition-colors border-b border-white/5 last:border-0 flex items-center gap-3"
                    >
                      <BookOpen className="w-4 h-4 text-cyan-400" />
                      <div>
                        <p className="text-sm font-bold text-white">{res.name}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">{res.type}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
              {searchQuery.trim() && searchResults.length === 0 && !isSearching && (
                <motion.div 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-[#0d0d12]/95 backdrop-blur-xl border border-white/10 rounded-2xl p-4 text-center shadow-2xl"
                >
                  <p className="text-xs text-white/40 font-bold uppercase tracking-widest">No results found</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}

      {selectedSubject ? (
        <div className="space-y-6">
          <button 
            onClick={() => setSelectedSubject(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Hub
          </button>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10`}>
                <BookOpen className="w-8 h-8 text-cyan-400" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-white">{selectedSubject.name}</h2>
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">{chapters.length} Chapters Available</p>
              </div>
            </div>
            {isAdmin && !selectedChapter && (
              <button 
                onClick={() => setIsAddingChapter(true)}
                className="bg-cyan-500 text-black p-3 rounded-2xl hover:bg-cyan-400 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
              >
                <Plus className="w-4 h-4" /> Add Chapter
              </button>
            )}
          </div>

          {isAdmin && isAddingChapter && !selectedChapter && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
              <input 
                type="text" 
                value={newChapterName} 
                onChange={(e) => setNewChapterName(e.target.value)}
                placeholder="Chapter Name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-2">
                <button onClick={handleAddChapter} className="flex-1 bg-cyan-500 text-black font-bold py-2 rounded-xl hover:bg-cyan-400 transition-all">Add</button>
                <button onClick={() => setIsAddingChapter(false)} className="flex-1 bg-white/5 text-white font-bold py-2 rounded-xl hover:bg-white/10 transition-all">Cancel</button>
              </div>
            </motion.div>
          )}

          {selectedChapter ? (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setSelectedChapter(null)}
                  className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Back to Chapters
                </button>
                {isAdmin && (
                  <button 
                    onClick={() => setIsAddingMaterial(true)}
                    className="bg-cyan-500 text-black p-3 rounded-2xl hover:bg-cyan-400 transition-all flex items-center gap-2 font-bold text-xs uppercase tracking-widest"
                  >
                    <Plus className="w-4 h-4" /> Add Material
                  </button>
                )}
              </div>

              {isAdmin && isAddingMaterial && (
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
                  <input 
                    type="text" 
                    value={newMaterialTitle} 
                    onChange={(e) => setNewMaterialTitle(e.target.value)}
                    placeholder="Material Title"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
                  />
                  <select 
                    value={newMaterialType} 
                    onChange={(e) => setNewMaterialType(e.target.value as any)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none text-white/60"
                  >
                    <option value="pdf">PDF Document</option>
                    <option value="note">Text Note</option>
                    <option value="test">Practice Test</option>
                  </select>
                  {newMaterialType === 'pdf' && (
                    <div className="space-y-2">
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={newMaterialUrl} 
                          onChange={(e) => setNewMaterialUrl(e.target.value)}
                          placeholder="PDF URL (Optional if uploading)"
                          className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
                        />
                        <label className="cursor-pointer bg-white/5 border border-white/10 rounded-xl px-4 py-2 flex items-center gap-2 hover:bg-white/10 transition-all">
                          <Upload className="w-4 h-4 text-cyan-400" />
                          <span className="text-xs font-bold text-white/60">Upload</span>
                          <input 
                            type="file" 
                            accept=".pdf" 
                            className="hidden" 
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                          />
                        </label>
                      </div>
                      {selectedFile && (
                        <p className="text-[10px] text-cyan-400 font-bold uppercase tracking-widest">Selected: {selectedFile.name}</p>
                      )}
                    </div>
                  )}
                  {newMaterialType === 'note' && (
                    <textarea 
                      value={newMaterialContent} 
                      onChange={(e) => setNewMaterialContent(e.target.value)}
                      placeholder="Note Content"
                      rows={4}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
                    />
                  )}
                  {newMaterialType === 'test' && (
                    <div className="space-y-2">
                      <p className="text-[10px] text-white/40 uppercase font-black">Upload Excel for Test (Mock)</p>
                      <button className="w-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 font-bold py-2 rounded-xl hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-2 text-xs">
                        <File className="w-4 h-4" /> Add Excel File
                      </button>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <button 
                      onClick={handleAddMaterial} 
                      disabled={uploading}
                      className="flex-1 bg-cyan-500 text-black font-bold py-2 rounded-xl hover:bg-cyan-400 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                      {uploading ? 'Uploading...' : 'Add'}
                    </button>
                    <button onClick={() => setIsAddingMaterial(false)} className="flex-1 bg-white/5 text-white font-bold py-2 rounded-xl hover:bg-white/10 transition-all">Cancel</button>
                  </div>
                </motion.div>
              )}

              <h3 className="text-lg font-bold text-white">{selectedChapter.name}</h3>
              <div className="grid grid-cols-1 gap-4">
                {materials.filter(m => m.type !== 'test').map((m, idx) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative group"
                  >
                    <button
                      onClick={() => onAccessMaterial(m)}
                      className="w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between group hover:bg-cyan-500/10 hover:border-cyan-400/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                          {m.type === 'pdf' ? <FileText className="w-5 h-5 text-red-400" /> : m.type === 'test' ? <Trophy className="w-5 h-5 text-yellow-400" /> : <File className="w-5 h-5 text-blue-400" />}
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-white/80 group-hover:text-white">{m.title}</span>
                          <p className="text-[9px] text-white/30 uppercase font-black">{m.type}</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={(e) => handleDeleteMaterial(e, m.id)}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
                {materials.length === 0 && <p className="text-center text-white/20 text-xs py-10">No materials added yet.</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {chapters.map((ch, idx) => (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group"
                >
                  <button
                    onClick={() => setSelectedChapter(ch)}
                    className="w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <Scroll className="w-6 h-6 text-purple-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{ch.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/20" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={(e) => handleDeleteChapter(e, ch.id)}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              ))}
              {chapters.length === 0 && <p className="text-center text-white/20 text-xs py-10">No chapters added yet.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-black text-white/30 uppercase tracking-[0.2em]">Select Your Subject</h3>
            {isAdmin && (
              <button 
                onClick={() => setIsAddingSubject(true)}
                className="bg-cyan-500 text-black px-4 py-1.5 rounded-full hover:bg-cyan-400 transition-all flex items-center gap-2 font-bold text-[10px] uppercase tracking-widest"
              >
                <Plus className="w-3 h-3" /> Add Subject
              </button>
            )}
            <div className="h-[1px] flex-1 bg-white/5 ml-4" />
          </div>

          {isAdmin && isAddingSubject && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 space-y-4">
              <input 
                type="text" 
                value={newSubjectName} 
                onChange={(e) => setNewSubjectName(e.target.value)}
                placeholder="Subject Name"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-cyan-500/50"
              />
              <div className="flex gap-2">
                <button onClick={handleAddSubject} className="flex-1 bg-cyan-500 text-black font-bold py-2 rounded-xl hover:bg-cyan-400 transition-all">Add</button>
                <button onClick={() => setIsAddingSubject(false)} className="flex-1 bg-white/5 text-white font-bold py-2 rounded-xl hover:bg-white/10 transition-all">Cancel</button>
              </div>
            </motion.div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {homeSubjects.map((subject, idx) => {
              const isLocked = subject.isLocked || false;
              return (
                <motion.div
                  key={subject.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: idx * 0.05 }}
                  className="relative group"
                >
                  <button
                    onClick={() => {
                      if (isLocked && !isAdmin) {
                        alert("This subject is locked!");
                        return;
                      }
                      setSelectedSubject(subject);
                    }}
                    className={`w-full group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 active:scale-95 shadow-sm ${isLocked && !isAdmin ? 'opacity-50 grayscale' : ''}`}
                  >
                    <div className="p-4 bg-gradient-to-br from-cyan-400/10 to-purple-500/10 rounded-2xl transition-all group-hover:shadow-[0_0_30px_rgba(34,211,238,0.1)] border border-white/5 relative">
                      <BookOpen className="w-8 h-8 text-cyan-400" />
                      {isLocked && !isAdmin && (
                        <div className="absolute -top-2 -right-2 bg-red-500/20 border border-red-500/50 p-1 rounded-full backdrop-blur-md">
                          <Lock className="w-3 h-3 text-red-400" />
                        </div>
                      )}
                      {!isLocked && !isAdmin && (
                        <div className="absolute -top-2 -right-2 bg-emerald-500/20 border border-emerald-500/50 p-1 rounded-full backdrop-blur-md">
                          <Unlock className="w-3 h-3 text-emerald-400" />
                        </div>
                      )}
                    </div>
                    <div className="text-center space-y-1">
                      <span className="text-sm font-black text-white/90 leading-tight tracking-tight">{subject.name}</span>
                      <p className="text-[8px] text-white/30 uppercase font-black tracking-widest">
                        {isLocked && !isAdmin ? 'Locked' : 'Explore Hub'}
                      </p>
                    </div>
                    
                    {/* Decorative element */}
                    <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-400/20" />
                  </button>
                  {isAdmin && (
                    <button 
                      onClick={(e) => handleDeleteSubject(e, subject.id)}
                      className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg transition-all z-10 hover:bg-red-600 active:scale-90"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </motion.div>
              );
            })}
            {homeSubjects.length === 0 && (
              <div className="col-span-2 backdrop-blur-xl bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center gap-4">
                <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                  <Database className="w-6 h-6 text-white/10" />
                </div>
                <p className="text-center text-white/20 text-xs uppercase tracking-widest font-black">Awaiting Content...</p>
              </div>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}

function TestTab({ profile, onAccessMaterial, isAdmin }: { profile: UserProfile; onAccessMaterial: (m: Material) => void; isAdmin: boolean }) {
  const [testSubjects, setTestSubjects] = useState<Subject[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<Subject | null>(null);
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [selectedChapter, setSelectedChapter] = useState<Chapter | null>(null);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [isTesting, setIsTesting] = useState(false);

  const handleDeleteTest = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!selectedSubject || !selectedChapter) return;
    if (confirm("Are you sure you want to delete this test?")) {
      try {
        await deleteDoc(doc(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`, id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials/${id}`);
      }
    }
  };

  useEffect(() => {
    const unsubscribe = onSnapshot(query(collection(db, 'test_subjects'), orderBy('order')), (snap) => {
      setTestSubjects(snap.docs.map(d => ({ id: d.id, ...d.data() } as Subject)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'test_subjects');
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      const q = query(collection(db, `subjects/${selectedSubject.id}/chapters`), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setChapters(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chapter)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `subjects/${selectedSubject.id}/chapters`);
      });
      return () => unsubscribe();
    } else {
      setChapters([]);
      setSelectedChapter(null);
    }
  }, [selectedSubject]);

  useEffect(() => {
    if (selectedSubject && selectedChapter) {
      const q = query(collection(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`), where('type', '==', 'test'), orderBy('order'));
      const unsubscribe = onSnapshot(q, (snap) => {
        setMaterials(snap.docs.map(d => ({ id: d.id, ...d.data() } as Material)));
      }, (error) => {
        handleFirestoreError(error, OperationType.LIST, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`);
      });
      return () => unsubscribe();
    } else {
      setMaterials([]);
    }
  }, [selectedSubject, selectedChapter]);

  if (loading) {
    return (
      <div className="flex items-center justify-center p-20">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-cyan-500/20 border-t-cyan-500 rounded-full" />
      </div>
    );
  }

  if (isTesting) {
    return (
      <div className="fixed inset-0 z-[999999] bg-[#0d0d12]">
        <LiveTestArena onExit={() => setIsTesting(false)} profile={profile} testId="daily-test-1" />
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 space-y-8"
    >
      {!selectedSubject && (
        <div className="space-y-8">
          {/* MEGA BUTTON */}
          <motion.button
            onClick={() => setIsTesting(true)}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            className="w-full p-6 rounded-[2rem] bg-gradient-to-r from-green-500/10 to-red-500/10 border-2 border-green-500/50 shadow-[0_0_30px_rgba(34,197,94,0.2)]"
          >
            <div className="flex flex-col items-center gap-2">
              <h2 className="text-xl font-black text-white uppercase tracking-widest">Live Daily Exam: 100 Questions | 100 Marks</h2>
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest">Starts at 8:00 PM</p>
            </div>
          </motion.button>

          {/* LEADERBOARD */}
          <div className="bg-[#1a1a24] border border-white/10 rounded-[2rem] p-6 space-y-4">
            <h3 className="text-xs font-black text-white uppercase tracking-widest">Top Performers</h3>
            <div className="space-y-2">
              {[
                { rank: 1, name: "Rahul Kumar", marks: 98 },
                { rank: 2, name: "Priya Singh", marks: 95 },
                { rank: 3, name: "Amit Verma", marks: 92 },
              ].map((user) => (
                <div key={user.rank} className="flex items-center justify-between p-3 bg-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-black text-cyan-400">#{user.rank}</span>
                    <span className="text-xs font-bold text-white">{user.name}</span>
                  </div>
                  <span className="text-xs font-black text-white">{user.marks}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 p-4 bg-gradient-to-r from-cyan-500 to-purple-500 rounded-xl flex items-center justify-between">
              <span className="text-xs font-black text-black">Your Rank: 12</span>
              <span className="text-xs font-black text-black">Marks: 85/100</span>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter">Practice Tests 🏆</h2>
            <p className="text-[10px] text-white/40 uppercase tracking-[0.3em] font-bold">Select a subject to start testing</p>
          </div>
        </div>
      )}

      {selectedSubject ? (
        <div className="space-y-6">
          <button 
            onClick={() => setSelectedSubject(null)}
            className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
          >
            <ChevronLeft className="w-4 h-4" />
            Back to Tests
          </button>

          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
              <Trophy className="w-8 h-8 text-yellow-400" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white">{selectedSubject.name}</h2>
              <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Available Tests</p>
            </div>
          </div>

          {selectedChapter ? (
            <div className="space-y-6">
              <button 
                onClick={() => setSelectedChapter(null)}
                className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
              >
                <ChevronLeft className="w-4 h-4" />
                Back to Chapters
              </button>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-white">{selectedChapter.name}</h3>
                {isAdmin && (
                  <button 
                    onClick={() => {
                      const title = prompt("Enter Daily Test Title:");
                      const url = prompt("Enter Test URL:");
                      if (title && url && selectedSubject && selectedChapter) {
                        addDoc(collection(db, `subjects/${selectedSubject.id}/chapters/${selectedChapter.id}/materials`), {
                          title,
                          url,
                          type: 'test',
                          subjectId: selectedSubject.id,
                          chapterId: selectedChapter.id,
                          order: materials.length,
                          createdAt: serverTimestamp()
                        }).catch(e => handleFirestoreError(e, OperationType.WRITE, 'materials'));
                      }
                    }}
                    className="bg-yellow-500 text-black px-6 py-3 rounded-2xl hover:bg-yellow-400 transition-all flex items-center gap-2 font-black text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(234,179,8,0.3)]"
                  >
                    <Plus className="w-4 h-4" /> Add Daily Test
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 gap-4">
                {materials.map((m, idx) => (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.1 }}
                    className="relative group"
                  >
                    <button
                      onClick={() => onAccessMaterial(m)}
                      className="w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-5 flex items-center justify-between group hover:bg-yellow-500/10 hover:border-yellow-400/30 transition-all"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                          <Trophy className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="text-left">
                          <span className="text-sm font-bold text-white/80 group-hover:text-white">{m.title}</span>
                          <p className="text-[9px] text-white/30 uppercase font-black">Practice Test</p>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-white/20" />
                    </button>
                    {isAdmin && (
                      <button 
                        onClick={(e) => handleDeleteTest(e, m.id)}
                        className="absolute -top-2 -right-2 w-8 h-8 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </motion.div>
                ))}
                {materials.length === 0 && <p className="text-center text-white/20 text-xs py-10">No tests added for this chapter yet.</p>}
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {chapters.map((ch, idx) => (
                <motion.div
                  key={ch.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <button
                    onClick={() => setSelectedChapter(ch)}
                    className="w-full backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 flex items-center justify-between group hover:bg-white/10 hover:border-white/20 transition-all active:scale-[0.98]"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
                        <Scroll className="w-6 h-6 text-yellow-400" />
                      </div>
                      <h3 className="text-lg font-bold text-white tracking-tight">{ch.name}</h3>
                    </div>
                    <ChevronRight className="w-5 h-5 text-white/20" />
                  </button>
                </motion.div>
              ))}
              {chapters.length === 0 && <p className="text-center text-white/20 text-xs py-10">No chapters added yet.</p>}
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-4">
          {testSubjects.map((subject, idx) => (
            <motion.div
              key={subject.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: idx * 0.05 }}
            >
              <button
                onClick={() => setSelectedSubject(subject)}
                className="w-full group relative backdrop-blur-xl bg-white/5 border border-white/10 rounded-[2rem] p-6 flex flex-col items-center gap-4 transition-all duration-300 hover:bg-white/10 hover:border-white/20 hover:-translate-y-1 active:scale-95 shadow-sm"
              >
                <div className="p-4 bg-gradient-to-br from-yellow-400/10 to-orange-500/10 rounded-2xl transition-all group-hover:shadow-[0_0_30px_rgba(234,179,8,0.1)] border border-white/5">
                  <Trophy className="w-8 h-8 text-yellow-400" />
                </div>
                <div className="text-center space-y-1">
                  <span className="text-sm font-black text-white/90 leading-tight tracking-tight">{subject.name}</span>
                  <p className="text-[8px] text-white/30 uppercase font-black tracking-widest">Test Hub</p>
                </div>
              </button>
            </motion.div>
          ))}
          {testSubjects.length === 0 && (
            <div className="col-span-2 backdrop-blur-xl bg-white/5 border border-dashed border-white/10 rounded-3xl p-12 flex flex-col items-center gap-4">
              <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center">
                <Database className="w-6 h-6 text-white/10" />
              </div>
              <p className="text-center text-white/20 text-xs uppercase tracking-widest font-black">Awaiting Content...</p>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function MaterialView({ material, onClose }: { material: Material; onClose: () => void }) {
  return (
    <div className="space-y-6">
      <button onClick={onClose} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest">
        <ChevronLeft className="w-4 h-4" />
        Close Material
      </button>
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/10">
            {material.type === 'pdf' ? <FileText className="w-6 h-6 text-red-400" /> : material.type === 'test' ? <Trophy className="w-6 h-6 text-yellow-400" /> : <File className="w-6 h-6 text-blue-400" />}
          </div>
          <div>
            <h2 className="text-xl font-black text-white">{material.title}</h2>
            <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">{material.type}</p>
          </div>
        </div>
        
        <div className="h-[1px] w-full bg-white/5" />
        
        {material.type === 'pdf' && (
          <div className="space-y-4">
            <div className="w-full aspect-[3/4] bg-white/5 rounded-2xl border border-white/10 overflow-hidden relative group">
              <iframe 
                src={material.url || null} 
                className="w-full h-full border-none"
                title={material.title}
              />
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <a 
                  href={material.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="bg-black/60 hover:bg-black/80 backdrop-blur-md text-white p-2 rounded-lg transition-all border border-white/10"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <p className="text-[10px] text-white/40 uppercase font-black tracking-widest">Live PDF Viewer</p>
              </div>
              <a href={material.url} target="_blank" rel="noopener noreferrer" className="text-xs text-cyan-500 hover:text-cyan-400 font-bold transition-colors flex items-center gap-1">
                <ExternalLink className="w-3 h-3" />
                Open Full Screen
              </a>
            </div>
          </div>
        )}

        {material.type === 'note' && (
          <div className="prose prose-invert max-w-none">
            <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">{material.content || "No content available for this note."}</p>
          </div>
        )}

        {material.type === 'test' && (
          <div className="space-y-6 text-center py-10">
            <div className="w-20 h-20 bg-yellow-500/10 rounded-full flex items-center justify-center border border-yellow-500/20 mx-auto">
              <Trophy className="w-10 h-10 text-yellow-500" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-bold">Ready for the Test?</h3>
              <p className="text-xs text-white/40">Test your knowledge on this chapter.</p>
            </div>
            <button className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-3 px-8 rounded-xl transition-all uppercase tracking-widest text-xs">
              Start Test Now
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfileTab({ profile: initialProfile, onLogout, isAdmin, onResetData, isResetting, onAdminClick }: { profile: UserProfile; onLogout: () => void; isAdmin: boolean; onResetData: () => void; isResetting: boolean; onAdminClick?: () => void }) {
  const [localProfile, setLocalProfile] = useState<UserProfile>(() => {
    const cached = localStorage.getItem('user_profile_v1');
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        return initialProfile;
      }
    }
    return initialProfile;
  });

  useEffect(() => {
    if (!initialProfile?.uid) return;
    
    const userRef = doc(db, 'users', initialProfile.uid);
    const unsubscribe = onSnapshot(userRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data() as UserProfile;
        setLocalProfile(data);
        localStorage.setItem('user_profile_v1', JSON.stringify(data));
      }
    });

    return () => unsubscribe();
  }, [initialProfile?.uid]);

  const displayProfile = localProfile || initialProfile;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 space-y-8 relative pb-32"
    >
      {/* Admin Button */}
      {isAdmin && onAdminClick && (
        <button 
          onClick={onAdminClick}
          className="absolute top-6 right-6 p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors text-white/40 hover:text-cyan-400"
        >
          <Settings className="w-5 h-5" />
        </button>
      )}

      {/* User Avatar & Info */}
      <div className="flex flex-col items-center text-center space-y-4">
        <div className="w-24 h-24 rounded-[2rem] bg-gradient-to-br from-cyan-400 to-purple-500 p-[3px] shadow-[0_0_30px_rgba(34,211,238,0.3)]">
          <div className="w-full h-full rounded-[1.8rem] bg-[#0d0d12] flex items-center justify-center overflow-hidden">
            {displayProfile.photoURL ? (
              <img src={displayProfile.photoURL || null} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <User className="w-12 h-12 text-white/20" />
            )}
          </div>
        </div>
        <div>
          <h2 className="text-2xl font-black text-white">{displayProfile.displayName}</h2>
          <p className="text-xs text-white/40 font-bold uppercase tracking-widest">{displayProfile.email}</p>
          {displayProfile.role === 'admin' && (
            <span className="inline-block mt-2 px-3 py-1 bg-cyan-500 text-black text-[10px] font-black rounded-full uppercase tracking-widest">Administrator</span>
          )}
        </div>
      </div>

      {/* Premium Stats (Streak Only) */}
      <div className="backdrop-blur-xl bg-white/5 border border-red-500/50 rounded-3xl p-6 text-center shadow-[0_0_15px_rgba(239,68,68,0.3)]">
        <p className="text-xs font-black text-red-400 uppercase tracking-widest mb-2">🔥 Current Study Streak</p>
        <p className="text-4xl font-black text-white">{displayProfile.streak || 0} <span className="text-xl text-white/50">Days</span></p>
      </div>

      {/* Core User Details */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
              <Target className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Target Score</p>
              <p className="text-sm font-bold text-white">{displayProfile.targetScore}</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
              <Clock className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Total Study Hours</p>
              <p className="text-sm font-bold text-white">{displayProfile.studyHours}</p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center border border-white/10">
              <Calendar className="w-5 h-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white/30 uppercase tracking-widest">Member Since</p>
              <p className="text-sm font-bold text-white">{new Date(displayProfile.createdAt).toLocaleDateString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Social / Community Icons */}
      <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 flex flex-col items-center justify-center space-y-4">
        <p className="text-xs font-black text-white/50 uppercase tracking-widest">Connect & Ask Doubts</p>
        <div className="flex items-center gap-6">
          <a 
            href="https://whatsapp.com/channel/0029VbD7lcvBKfhwP2LXQG1A" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-14 h-14 rounded-full border-2 border-green-500/50 bg-green-500/10 flex items-center justify-center text-green-400 hover:scale-110 hover:bg-green-500/20 hover:shadow-[0_0_20px_rgba(34,197,94,0.4)] transition-all duration-300"
          >
            <MessageCircle className="w-6 h-6" />
          </a>
          <a 
            href="https://t.me/Lakshya_ai_doubt_solver" 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-14 h-14 rounded-full border-2 border-cyan-500/50 bg-cyan-500/10 flex items-center justify-center text-cyan-400 hover:scale-110 hover:bg-cyan-500/20 hover:shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all duration-300"
          >
            <Send className="w-6 h-6" />
          </a>
        </div>
      </div>

      {/* Logout Button */}
      <div className="space-y-3 pt-4">
        {isAdmin && (
          <button 
            onClick={onResetData}
            disabled={isResetting}
            className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Trash2 className="w-4 h-4" /> {isResetting ? 'Resetting...' : 'Reset All Data'}
          </button>
        )}
        <button 
          onClick={onLogout}
          className="w-full bg-red-500/10 border border-red-500/20 text-red-500 py-4 rounded-3xl flex items-center justify-center gap-3 font-black text-xs uppercase tracking-widest hover:bg-red-500/20 transition-all"
        >
          <LogOut className="w-4 h-4" /> Logout Session
        </button>
      </div>
    </motion.div>
  );
}

interface StudyBlock {
  id: string;
  subjectName: string;
  startTime: string;
  endTime: string;
  completed: boolean;
}

function StudyPlanner({ profile }: { profile: UserProfile | null }) {
  const [dailySchedule, setDailySchedule] = useState<StudyBlock[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [subjectName, setSubjectName] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  
  const [currentTime, setCurrentTime] = useState(new Date());
  const notifiedBlocks = useRef<string[]>([]);
  const alarmTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Load from Firestore
  useEffect(() => {
    if (!profile?.uid) return;

    const scheduleRef = doc(db, 'users', profile.uid, 'studySchedule', 'daily');
    const unsubscribe = onSnapshot(scheduleRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (data.schedule) {
          const normalized = data.schedule.map((b: any) => ({
            ...b,
            completed: b.completed ?? false
          }));
          setDailySchedule(normalized.sort((a: StudyBlock, b: StudyBlock) => a.startTime.localeCompare(b.startTime)));
        }
      }
    });

    return () => unsubscribe();
  }, [profile?.uid]);

  const playAlarmSound = () => {
    try {
      const audio = new Audio('https://actions.google.com/sounds/v1/alarms/beep_short.ogg');
      audio.play().catch(e => console.log("Audio play blocked by browser policy. User interaction required first.", e));
    } catch (e) {
      console.log("Audio playback error:", e);
    }
  };

  // Real-time updates & Notifications
  useEffect(() => {
    // Update current time every minute for UI
    const timeInterval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000);

    const scheduleNextAlarm = () => {
      if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current);

      const now = new Date();
      const currentHours = now.getHours();
      const currentMinutes = now.getMinutes();
      const currentTimeInMinutes = currentHours * 60 + currentMinutes;

      // Filter for upcoming blocks that haven't been notified yet
      const upcomingBlocks = dailySchedule
        .map(block => {
          const [h, m] = block.startTime.split(':').map(Number);
          const startTimeInMinutes = h * 60 + m;
          return { ...block, startTimeInMinutes };
        })
        .filter(block => {
          // Notify if it's exactly now and not notified
          if (block.startTimeInMinutes === currentTimeInMinutes) {
            return !notifiedBlocks.current.includes(block.id);
          }
          return block.startTimeInMinutes > currentTimeInMinutes;
        })
        .sort((a, b) => a.startTimeInMinutes - b.startTimeInMinutes);

      if (upcomingBlocks.length > 0) {
        const nextBlock = upcomingBlocks[0];
        
        if (nextBlock.startTimeInMinutes === currentTimeInMinutes) {
          // Trigger immediately
          if (Notification.permission === 'granted' && !notifiedBlocks.current.includes(nextBlock.id)) {
            new Notification("📚 Lakshya Alert!", { 
              body: `Mission Start: ${nextBlock.subjectName}`,
              icon: "/favicon.ico"
            });
            playAlarmSound();
            notifiedBlocks.current.push(nextBlock.id);
          }
          // Schedule next one after a small delay to avoid infinite loop if multiple at same time
          alarmTimeoutRef.current = setTimeout(scheduleNextAlarm, 1000);
          return;
        }

        const delayInMinutes = nextBlock.startTimeInMinutes - currentTimeInMinutes;
        const delayInMs = (delayInMinutes * 60 * 1000) - (now.getSeconds() * 1000) - now.getMilliseconds();

        alarmTimeoutRef.current = setTimeout(() => {
          if (Notification.permission === 'granted' && !notifiedBlocks.current.includes(nextBlock.id)) {
            new Notification("📚 Lakshya Alert!", { 
              body: `Mission Start: ${nextBlock.subjectName}`,
              icon: "/favicon.ico"
            });
            playAlarmSound();
            notifiedBlocks.current.push(nextBlock.id);
          }
          scheduleNextAlarm();
        }, Math.max(0, delayInMs));
      } else {
        // Reset at midnight
        const timeToMidnightInMinutes = (24 * 60 - currentTimeInMinutes);
        const delayInMs = (timeToMidnightInMinutes * 60 * 1000) - (now.getSeconds() * 1000) - now.getMilliseconds();
        
        alarmTimeoutRef.current = setTimeout(() => {
          notifiedBlocks.current = [];
          setCurrentTime(new Date());
          scheduleNextAlarm();
        }, Math.max(0, delayInMs));
      }
    };

    scheduleNextAlarm();

    return () => {
      clearInterval(timeInterval);
      if (alarmTimeoutRef.current) clearTimeout(alarmTimeoutRef.current);
    };
  }, [dailySchedule]);

  const saveSchedule = async (newSchedule: StudyBlock[]) => {
    const sorted = [...newSchedule].sort((a, b) => a.startTime.localeCompare(b.startTime));
    setDailySchedule(sorted);
    
    if (profile?.uid) {
      const scheduleRef = doc(db, 'users', profile.uid, 'studySchedule', 'daily');
      try {
        await setDoc(scheduleRef, { schedule: sorted }, { merge: true });
      } catch (error) {
        handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/studySchedule/daily`);
      }
    }
  };

  const handleSaveBlock = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subjectName || !startTime || !endTime) return;
    
    if (editingId) {
      const updated = dailySchedule.map(block => 
        block.id === editingId ? { ...block, subjectName, startTime, endTime } : block
      );
      notifiedBlocks.current = notifiedBlocks.current.filter(id => id !== editingId);
      saveSchedule(updated);
    } else {
      const newBlock: StudyBlock = {
        id: Date.now().toString(),
        subjectName,
        startTime,
        endTime,
        completed: false
      };
      saveSchedule([...dailySchedule, newBlock]);
    }
    
    closeModal();
  };

  const toggleComplete = (id: string) => {
    const updated = dailySchedule.map(block => 
      block.id === id ? { ...block, completed: !block.completed } : block
    );
    saveSchedule(updated);
  };

  const deleteBlock = (id: string) => {
    const updated = dailySchedule.filter(block => block.id !== id);
    saveSchedule(updated);
    setShowDeleteConfirm(null);
  };


  const editBlock = (block: StudyBlock) => {
    // Ensure modal pre-fills with current block data
    setEditingId(block.id);
    setSubjectName(block.subjectName);
    setStartTime(block.startTime);
    setEndTime(block.endTime);
    setShowModal(true);
  };

  const openModal = () => {
    setEditingId(null);
    setSubjectName('');
    setStartTime('');
    setEndTime('');
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setSubjectName('');
    setStartTime('');
    setEndTime('');
  };

  const requestNotificationPermission = () => {
    if (!('Notification' in window)) {
      alert('This browser does not support desktop notification');
      return;
    }
    Notification.requestPermission().then(permission => {
      console.log("Notification permission:", permission);
      if (permission === 'granted') {
        new Notification("📚 Lakshya", { body: "Study alarms are now active!" });
      }
    });
  };

  const getBlockState = (start: string, end: string) => {
    const now = currentTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    const [startH, startM] = start.split(':').map(Number);
    const startTotal = startH * 60 + startM;
    
    const [endH, endM] = end.split(':').map(Number);
    const endTotal = endH * 60 + endM;
    
    if (currentMinutes >= startTotal && currentMinutes < endTotal) return 'active';
    if (currentMinutes >= endTotal) return 'past';
    return 'upcoming';
  };

  // Calculate completion percentage
  const totalBlocks = dailySchedule.length;
  const completedBlocks = dailySchedule.filter(b => b.completed).length;
  const completionPercentage = totalBlocks === 0 ? 0 : Math.round((completedBlocks / totalBlocks) * 100);
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (completionPercentage / 100) * circumference;

  const firstName = profile?.displayName?.split(' ')[0] || 'Scholar';

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="p-6 space-y-8 pb-32 min-h-screen bg-[#050000] relative overflow-hidden"
    >
      {/* Background Glow */}
      <div className="absolute inset-0 bg-cyan-900/5 pointer-events-none mix-blend-screen" />
      
      {/* Header Section */}
      <div className="relative z-10 flex flex-col space-y-6">
        <div className="flex justify-between items-start">
          <button 
            onClick={requestNotificationPermission}
            className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/30 rounded-2xl hover:bg-cyan-500/20 transition-all flex items-center gap-3 text-sm font-black text-cyan-400 shadow-[0_0_20px_rgba(34,211,238,0.2)] group"
          >
            <Bell className="w-5 h-5 group-hover:animate-bounce" />
            <span>🔔 Enable Study Alarms</span>
          </button>
        </div>

        <div className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.5)] flex items-center justify-between">
          <div>
            <p className="text-cyan-400 text-xs font-bold uppercase tracking-widest mb-1">
              {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <h2 className="text-2xl font-black text-white tracking-tight">
              Top of the morning, {firstName}! 🚀
            </h2>
            <p className="text-white/40 text-sm mt-1">Aaj ka {completionPercentage}% task complete</p>
          </div>
          
          <div className="relative w-20 h-20 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 80 80">
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-white/10"
                strokeWidth="6"
                fill="none"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                className="stroke-[url(#gradient)] transition-all duration-1000 ease-out"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#22d3ee" />
                  <stop offset="100%" stopColor="#ec4899" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex items-center justify-center flex-col">
              <span className="text-white font-black text-lg leading-none">{completionPercentage}%</span>
              <span className="text-[8px] text-white/40 uppercase font-bold mt-1">Done</span>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline View */}
      <div className="relative z-10 space-y-4">
        {dailySchedule.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-white/10 rounded-3xl bg-white/5 backdrop-blur-md">
            <CalendarClock className="w-16 h-16 text-white/20 mx-auto mb-4" />
            <p className="text-white/60 text-lg font-bold">No missions scheduled.</p>
            <p className="text-white/40 text-sm mt-2">Tap the glowing orb to add your first study block.</p>
          </div>
        ) : (
          <div className="relative pl-6 border-l-2 border-cyan-500/30 space-y-6">
            {dailySchedule.map((block, index) => {
              const state = getBlockState(block.startTime, block.endTime);
              return (
                <motion.div 
                  key={block.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="relative group"
                >
                  {/* Timeline Dot */}
                  <div className={`absolute -left-[31px] top-8 w-4 h-4 rounded-full border-4 border-[#050000] z-10 ${
                    state === 'active' 
                      ? 'bg-cyan-400 shadow-[0_0_15px_rgba(34,211,238,1)]' 
                      : block.completed
                        ? 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'
                        : state === 'past' 
                          ? 'bg-white/40' 
                          : 'bg-white/10'
                  }`} />
                  
                  {/* Card */}
                  <div className={`p-4 rounded-3xl border transition-all duration-500 backdrop-blur-xl flex items-center gap-4 ${
                    block.completed 
                      ? 'bg-white/5 border-green-500/20 opacity-50' 
                      : state === 'active' 
                        ? 'bg-cyan-900/20 border-cyan-400 shadow-[0_0_30px_rgba(34,211,238,0.1)]' 
                        : 'bg-white/5 border-white/10 hover:border-white/20'
                  }`}>
                    {/* LEFT SIDE: Checkbox */}
                    <button 
                      onClick={() => toggleComplete(block.id)}
                      className={`shrink-0 transition-all duration-300 ${
                        block.completed ? 'text-green-500 scale-110' : 'text-white/20 hover:text-white/40'
                      }`}
                    >
                      <CheckCircle className={`w-8 h-8 ${block.completed ? 'drop-shadow-[0_0_8px_rgba(34,197,94,0.8)]' : ''}`} />
                    </button>

                    {/* MIDDLE: Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        {state === 'active' && !block.completed && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" />
                            <span className="text-[9px] font-black text-red-400 uppercase tracking-widest">Active</span>
                          </div>
                        )}
                        <span className={`text-[10px] font-bold uppercase tracking-widest ${
                          block.completed ? 'text-green-500/60' : 'text-white/40'
                        }`}>
                          {block.startTime} - {block.endTime}
                        </span>
                      </div>
                      <h3 className={`font-black text-lg truncate tracking-tight transition-all ${
                        block.completed ? 'text-white/40 line-through' : 'text-white'
                      }`}>
                        {block.subjectName}
                      </h3>
                    </div>
                    
                    {/* RIGHT SIDE: Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <button 
                        onClick={() => editBlock(block)} 
                        className="p-2.5 bg-white/5 rounded-2xl hover:bg-white/10 text-cyan-400 border border-white/5 transition-all active:scale-90"
                      >
                        <Edit2 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setShowDeleteConfirm(block.id)} 
                        className="p-2.5 bg-red-500/5 rounded-2xl hover:bg-red-500/10 text-red-500 border border-red-500/10 transition-all active:scale-90"
                      >
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}

          </div>
        )}
      </div>

      {/* FAB */}
      <button 
        onClick={() => openModal()}
        className="fixed bottom-28 right-6 z-50 w-16 h-16 bg-cyan-400 rounded-full flex items-center justify-center text-black shadow-[0_0_40px_rgba(34,211,238,0.8)] hover:scale-110 hover:bg-cyan-300 transition-all active:scale-95"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Unified Modal (Add/Edit) */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0a0a0f] border border-white/10 rounded-[2rem] p-8 w-full max-w-md shadow-[0_20px_60px_rgba(0,0,0,0.8)] relative"
            >
              <button 
                onClick={closeModal}
                className="absolute top-6 right-6 text-white/40 hover:text-white transition-colors"
              >
                <XCircle className="w-6 h-6" />
              </button>
              
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-8">
                {editingId ? 'Edit Study Block' : 'Add Study Block'}
              </h3>
              
              <form onSubmit={handleSaveBlock} className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">Subject Name</label>
                  <input 
                    type="text" 
                    value={subjectName}
                    onChange={e => setSubjectName(e.target.value)}
                    placeholder="e.g., Quantum Physics"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none placeholder:text-white/20"
                    required
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">Start Time</label>
                    <input 
                      type="time" 
                      value={startTime}
                      onChange={e => setStartTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none [color-scheme:dark]"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-cyan-400 uppercase tracking-widest mb-2">End Time</label>
                    <input 
                      type="time" 
                      value={endTime}
                      onChange={e => setEndTime(e.target.value)}
                      className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-white font-medium focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none [color-scheme:dark]"
                      required
                    />
                  </div>
                </div>
                <button 
                  type="submit"
                  className="w-full mt-8 py-4 bg-green-500 text-black font-black text-lg rounded-2xl uppercase tracking-widest hover:bg-green-400 transition-all shadow-[0_0_30px_rgba(34,197,94,0.4)] hover:shadow-[0_0_40px_rgba(34,197,94,0.6)]"
                >
                  Save Mission
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/80 backdrop-blur-xl">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-[#0a0a0f] border border-red-500/30 rounded-[2rem] p-8 w-full max-w-md shadow-[0_20px_60px_rgba(239,68,68,0.2)] relative text-center"
            >
              <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-red-500/20">
                <Trash2 className="w-10 h-10 text-red-500" />
              </div>
              <h3 className="text-2xl font-black text-white uppercase tracking-tight mb-2">
                Delete Mission?
              </h3>
              <p className="text-white/50 mb-8">
                Are you sure you want to delete "{dailySchedule.find(b => b.id === showDeleteConfirm)?.subjectName}"? This action cannot be undone.
              </p>
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={() => setShowDeleteConfirm(null)}
                  className="py-4 bg-white/5 text-white font-bold rounded-2xl hover:bg-white/10 transition-colors border border-white/10"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => deleteBlock(showDeleteConfirm)}
                  className="py-4 bg-red-500 text-white font-bold rounded-2xl hover:bg-red-600 transition-colors shadow-[0_0_20px_rgba(239,68,68,0.4)]"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function NavButton({ 
  icon, 
  label, 
  active, 
  onClick 
}: { 
  icon: ReactElement; 
  label: string; 
  active: boolean; 
  onClick: () => void;
}) {
  return (
    <button 
      onClick={onClick}
      className="relative flex flex-col items-center justify-center py-2 px-4 rounded-2xl transition-all duration-300 active:scale-90 flex-1"
    >
      {active && (
        <motion.div 
          layoutId="nav-active-bg"
          className="absolute inset-0 bg-cyan-500/10 border border-cyan-400/20 rounded-2xl shadow-[0_0_20px_rgba(34,211,238,0.1)]"
          transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
        />
      )}
      <motion.div 
        animate={{ 
          scale: active ? 1.15 : 1,
          y: active ? -2 : 0,
          color: active ? '#22d3ee' : 'rgba(255,255,255,0.2)'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative z-10 mb-1"
      >
        {cloneElement(icon, { className: 'w-5 h-5' } as any)}
      </motion.div>
      <motion.span 
        animate={{ 
          opacity: active ? 1 : 0.4,
          scale: active ? 1 : 0.9,
          color: active ? '#ffffff' : 'rgba(255,255,255,0.4)'
        }}
        className="relative z-10 text-[8px] font-black uppercase tracking-[0.15em]"
      >
        {label}
      </motion.span>
    </button>
  );
}

const DUMMY_QUESTIONS = [
  {
    id: 'q1',
    questionText: 'What is the SI unit of electric current?',
    options: ['Volt', 'Ampere', 'Ohm', 'Watt'],
    correctAnswer: 'Ampere'
  },
  {
    id: 'q2',
    questionText: 'Which gas is most abundant in the Earth\'s atmosphere?',
    options: ['Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Hydrogen'],
    correctAnswer: 'Nitrogen'
  },
  {
    id: 'q3',
    questionText: 'Who is known as the father of computers?',
    options: ['Alan Turing', 'Charles Babbage', 'Bill Gates', 'Steve Jobs'],
    correctAnswer: 'Charles Babbage'
  },
  {
    id: 'q4',
    questionText: 'What is the chemical formula for water?',
    options: ['H2O', 'CO2', 'O2', 'NaCl'],
    correctAnswer: 'H2O'
  },
  {
    id: 'q5',
    questionText: 'Which planet is known as the Red Planet?',
    options: ['Venus', 'Jupiter', 'Saturn', 'Mars'],
    correctAnswer: 'Mars'
  }
];

export function LiveTestArena({ onExit, profile, testId }: { onExit?: () => void, profile: UserProfile, testId: string }) {
  const [testState, setTestState] = useState<'waiting' | 'active' | 'finished' | 'locked'>(() => {
    const now = new Date();
    const targetTime = new Date();
    targetTime.setHours(20, 0, 0, 0);
    if (now.getTime() > targetTime.getTime()) {
      return 'locked';
    }
    return 'waiting';
  });
  const [timeToStart, setTimeToStart] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(3600); // 1 hour
  const [showResults, setShowResults] = useState(false);
  const [resultsData, setResultsData] = useState<any>(null);

  useEffect(() => {
    const fetchQuestions = async () => {
      try {
        const qSnap = await getDocs(collection(db, `live_tests/${testId}/questions`));
        if (!qSnap.empty) {
          setQuestions(qSnap.docs.map(d => ({ id: d.id, ...d.data() })));
        } else {
          // Fallback if no questions found
          setQuestions([]);
        }
      } catch (error) {
        console.error("Error fetching questions:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchQuestions();
  }, [testId]);

  useEffect(() => {
    if (testState !== 'waiting') return;

    const interval = setInterval(() => {
      const now = new Date();
      const targetTime = new Date();
      targetTime.setHours(20, 0, 0, 0);
      const diff = targetTime.getTime() - now.getTime();

      if (diff <= 0) {
        setTestState('active');
        clearInterval(interval);
      } else {
        setTimeToStart(Math.floor(diff / 1000));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [testState]);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (testState === 'active' && timeLeft > 0) {
      timer = setInterval(() => {
        setTimeLeft(prev => prev - 1);
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [testState, timeLeft]);

  useEffect(() => {
    if (testState === 'active' && timeLeft === 0) {
      submitTest();
    }
  }, [timeLeft, testState]);

  const handleOptionSelect = (questionId: string, option: string) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [questionId]: option
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
    } else {
      submitTest();
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
    }
  };

  const calculateResults = () => {
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach(q => {
      const answer = selectedAnswers[q.id];
      if (!answer) {
        skipped++;
      } else if (answer === q.correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    return { correct, wrong, skipped, score: questions.length > 0 ? correct * (100 / questions.length) : 0 };
  };

  const submitTest = async () => {
    const results = calculateResults();
    const timeTakenSeconds = 3600 - timeLeft;

    const testResult = {
      testId,
      userId: profile.uid,
      userName: profile.displayName,
      userPhoto: profile.photoURL || null,
      score: results.score,
      timeTaken: timeTakenSeconds,
      submittedAt: new Date().toISOString(),
      userAnswers: questions.map(q => ({
        questionId: q.id,
        questionText: q.questionText,
        userChoice: selectedAnswers[q.id] || null,
        correctChoice: q.correctAnswer
      }))
    };

    try {
      const resultRef = doc(db, 'users', profile.uid, 'testResults', testId);
      await setDoc(resultRef, testResult);
      setResultsData(testResult);
      setTestState('finished');
      setShowResults(true);
    } catch (error) {
      console.error("Error submitting test:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${profile.uid}/testResults/${testId}`);
      // Fallback to show results even if saving fails
      setResultsData(testResult);
      setTestState('finished');
      setShowResults(true);
    }
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#050000] flex items-center justify-center p-6 font-sans">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-8 h-8 border-2 border-red-500/20 border-t-red-500 rounded-full" />
      </div>
    );
  }

  if (testState === 'locked') {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#050000] flex items-center justify-center p-6 font-sans">
        <div className="backdrop-blur-xl bg-red-950/20 border border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)]">
          <XCircle className="w-20 h-20 text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Entry Closed</h2>
          <p className="text-red-400/80 text-sm mb-8 font-bold uppercase tracking-widest">You Missed the Battle</p>
          <button 
            onClick={onExit}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-black py-4 rounded-2xl text-lg hover:bg-red-500/20 transition-all active:scale-95 uppercase tracking-widest"
          >
            Return to Base
          </button>
        </div>
      </div>
    );
  }

  if (testState === 'waiting') {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#050000] flex items-center justify-center p-6 font-sans">
        <div className="backdrop-blur-xl bg-red-950/10 border border-red-500/20 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.1)] relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent pointer-events-none" />
          <div className="relative z-10">
            <Clock className="w-16 h-16 text-red-500 mx-auto mb-6 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-2">Waiting Room</h2>
            <p className="text-red-400/60 text-xs mb-8 font-bold uppercase tracking-widest">Battle Commences At 8:00 PM</p>
            
            <div className="bg-[#050000] border border-red-500/30 rounded-2xl p-6 mb-8 shadow-[inset_0_0_20px_rgba(239,68,68,0.1)]">
              <div className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-red-200 tracking-tighter font-mono drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                {formatTime(timeToStart)}
              </div>
              <p className="text-[10px] text-red-400/40 uppercase font-black tracking-[0.3em] mt-2">Time Remaining</p>
            </div>

            <button 
              onClick={onExit}
              className="text-white/40 hover:text-white transition-colors text-xs font-bold uppercase tracking-widest"
            >
              Leave Waiting Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (showResults && resultsData) {
    return (
      <UniversalResultBoard
        testId={testId}
        score={resultsData.score}
        totalQuestions={questions.length}
        timeTaken={resultsData.timeTaken}
        userAnswers={resultsData.userAnswers}
        testType="live"
        onClose={onExit || (() => {})}
        profile={profile}
      />
    );
  }

  if (testState === 'finished') {
    const results = calculateResults();
    return (
      <div className="fixed inset-0 z-[99999] bg-[#050000] flex items-center justify-center p-6 font-sans">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="backdrop-blur-xl bg-red-950/20 border border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-[0_0_50px_rgba(239,68,68,0.15)]"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-red-500 to-orange-500 mx-auto flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
            <Trophy className="w-12 h-12 text-black" />
          </div>
          <h2 className="text-3xl font-black text-white uppercase tracking-tighter mb-2">Battle Complete!</h2>
          <p className="text-2xl font-black text-red-400 mb-8 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">
            Marks: {results.score.toFixed(1)} / 100
          </p>
          
          <div className="grid grid-cols-3 gap-4 mb-8">
            <div className="bg-white/5 rounded-2xl p-4 border border-emerald-500/20">
               <CheckCircle className="w-6 h-6 text-emerald-400 mx-auto mb-2" />
              <p className="text-xl font-black text-emerald-400">{results.correct}</p>
              <p className="text-[10px] text-white/40 uppercase font-bold">Correct</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-red-500/20">
              <XCircle className="w-6 h-6 text-red-400 mx-auto mb-2" />
              <p className="text-xl font-black text-red-400">{results.wrong}</p>
              <p className="text-[10px] text-white/40 uppercase font-bold">Wrong</p>
            </div>
            <div className="bg-white/5 rounded-2xl p-4 border border-white/10">
              <MinusCircle className="w-6 h-6 text-white/40 mx-auto mb-2" />
              <p className="text-xl font-black text-white/60">{results.skipped}</p>
              <p className="text-[10px] text-white/40 uppercase font-bold">Skipped</p>
            </div>
          </div>

          <button 
            onClick={() => setShowResults(true)}
            className="w-full bg-red-500/10 border border-red-500/30 text-red-400 font-black py-4 rounded-2xl text-lg hover:bg-red-500/20 transition-all active:scale-95 uppercase tracking-widest"
          >
            View Leaderboard & Ranks
          </button>
        </motion.div>
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="fixed inset-0 z-[99999] bg-[#050000] flex items-center justify-center p-6 font-sans">
        <div className="text-center">
          <p className="text-red-400 font-bold uppercase tracking-widest mb-4">No Battle Data Found</p>
          <button onClick={onExit} className="text-white/60 hover:text-white underline text-sm">Return</button>
        </div>
      </div>
    );
  }

  const currentQuestion = questions[currentQuestionIndex];

  return (
  <div className="fixed inset-0 z-[99999] bg-[#050000] flex flex-col text-white font-sans">
    
    {/* 1. Header (Timer & Progress) */}
    <div className="flex-none p-4 border-b border-red-500/20 flex justify-between items-center bg-red-950/10 backdrop-blur-md">
      <div className="font-bold text-red-400/80 uppercase tracking-widest text-xs">Question {currentQuestionIndex + 1} / {questions.length}</div>
      <div className="text-red-500 font-black tracking-widest text-lg drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]">{formatTime(timeLeft)}</div>
    </div>

    {/* 2. Scrollable Question Area */}
    <div className="flex-1 overflow-y-auto p-4 md:p-8 max-w-3xl mx-auto w-full">
      <h2 className="text-2xl font-medium mb-8 leading-relaxed">{currentQuestion.questionText}</h2>
      <div className="space-y-4">
        {currentQuestion.options.map((option: string, idx: number) => {
          const isSelected = selectedAnswers[currentQuestion.id] === option;
          return (
            <button
              key={idx}
              onClick={() => handleOptionSelect(currentQuestion.id, option)}
              className={`w-full text-left p-6 rounded-2xl border transition-all duration-200 flex justify-between items-center group ${
                isSelected 
                  ? 'bg-red-500/10 border-red-500 shadow-[0_0_20px_rgba(239,68,68,0.2)]' 
                  : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20'
              }`}
            >
              <span className={`text-lg ${isSelected ? 'text-red-400 font-bold' : 'text-white/80 font-medium'}`}>
                {option}
              </span>
              {isSelected && (
                <CheckCircle className="w-6 h-6 text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
              )}
            </button>
          );
        })}
      </div>
    </div>

    {/* 3. Bottom Controls (Pushed to bottom naturally) */}
    <div className="flex-none p-4 pb-6 border-t border-red-500/20 bg-[#050000] flex justify-between items-center relative z-50 max-w-3xl mx-auto w-full">
      
      <button 
        onClick={() => setCurrentQuestionIndex(prev => prev - 1)} 
        disabled={currentQuestionIndex === 0} 
        className="px-6 py-3 bg-white/5 rounded-xl text-white/50 disabled:opacity-30 disabled:cursor-not-allowed font-bold uppercase tracking-widest text-xs transition-colors hover:bg-white/10"
      >
        Previous
      </button>

      {currentQuestionIndex < questions.length - 1 ? (
        <button 
          onClick={() => setCurrentQuestionIndex(prev => prev + 1)} 
          className="px-8 py-3 bg-red-500/10 text-red-400 border border-red-500/50 rounded-xl font-black uppercase tracking-widest text-xs shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-red-500/20 transition-all"
        >
          Next
        </button>
      ) : (
        <button 
          onClick={submitTest} 
          className="px-8 py-3 bg-red-500 text-white rounded-xl font-black uppercase tracking-widest text-xs shadow-[0_0_20px_rgba(239,68,68,0.5)] hover:bg-red-400 transition-all"
        >
          Submit Battle
        </button>
      )}

    </div>
  </div>
  );
}

export function AdminDashboard({ onBack }: { onBack: () => void }) {
  const [isUploading, setIsUploading] = useState(false);
  const [examTitle, setExamTitle] = useState('');
  const [examDate, setExamDate] = useState('');
  const [examTime, setExamTime] = useState('20:00');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [isChapterUploading, setIsChapterUploading] = useState(false);
  const [chapterSubject, setChapterSubject] = useState('Science');
  const [chapterName, setChapterName] = useState('');
  const [chapterFile, setChapterFile] = useState<File | null>(null);

  const handlePublishTest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!examTitle || !examDate || !examTime || !selectedFile) {
      alert("Please fill all fields and select a file.");
      return;
    }
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      alert("✅ Success! Live Test scheduled for 8:00 PM with 100 questions.");
      setExamTitle('');
      setExamDate('');
      setExamTime('20:00');
      setSelectedFile(null);
    }, 2000);
  };

  const handleChapterUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chapterSubject || !chapterName || !chapterFile) {
      alert("Please fill all fields and select a file.");
      return;
    }
    setIsChapterUploading(true);
    setTimeout(() => {
      setIsChapterUploading(false);
      alert(`✅ Chapter Test uploaded successfully to ${chapterSubject}.`);
      setChapterSubject('Science');
      setChapterName('');
      setChapterFile(null);
    }, 2000);
  };

  return (
    <div className="min-h-screen bg-[#0d0d12] text-white p-6 font-sans pb-32">
      <div className="flex items-center gap-4 mb-8">
        <button onClick={onBack} className="p-2 bg-white/5 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <h1 className="text-2xl font-black uppercase tracking-widest text-cyan-400">Admin Control Center ⚙️</h1>
      </div>

      <div className="space-y-12 max-w-2xl mx-auto">
        <form onSubmit={handlePublishTest} className="space-y-6">
          {/* Card 1: Schedule */}
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-white/80 uppercase tracking-wider">1. Schedule Daily Live Exam</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Exam Title</label>
                <input 
                  type="text" 
                  placeholder="e.g., BSEB Science Maha-Battle" 
                  value={examTitle} 
                  onChange={e => setExamTitle(e.target.value)} 
                  className="w-full bg-[#0d0d12] border border-white/10 rounded-xl p-4 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none" 
                  required 
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Date</label>
                  <input 
                    type="date" 
                    value={examDate} 
                    onChange={e => setExamDate(e.target.value)} 
                    className="w-full bg-[#0d0d12] border border-white/10 rounded-xl p-4 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none [color-scheme:dark]" 
                    required 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Time</label>
                  <input 
                    type="time" 
                    value={examTime} 
                    onChange={e => setExamTime(e.target.value)} 
                    className="w-full bg-[#0d0d12] border border-white/10 rounded-xl p-4 text-white focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all outline-none [color-scheme:dark]" 
                    required 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Card 2: Upload */}
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-white/80 uppercase tracking-wider">2. Bulk Question Upload</h2>
            <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-cyan-400/50 transition-colors bg-[#0d0d12]/50 relative group">
              <Upload className="w-12 h-12 text-cyan-400 mx-auto mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
              <p className="text-sm font-bold text-white/60 mb-2">Drag & Drop your CSV/Excel file here</p>
              <p className="text-xs text-white/40 mb-6">or click to browse from your device</p>
              
              <input 
                type="file" 
                accept=".csv, .xlsx" 
                className="hidden" 
                id="file-upload" 
                onChange={e => setSelectedFile(e.target.files?.[0] || null)} 
                required 
              />
              <label 
                htmlFor="file-upload" 
                className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95"
              >
                {selectedFile ? selectedFile.name : 'Choose File'}
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isUploading}
            className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest transition-all ${
              isUploading 
                ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                : 'bg-emerald-500 text-black shadow-[0_0_20px_rgba(16,185,129,0.4)] hover:shadow-[0_0_30px_rgba(16,185,129,0.6)] active:scale-95'
            }`}
          >
            {isUploading ? 'Uploading to Server...' : 'Upload 100 Questions & Publish 🚀'}
          </button>
        </form>

        <form onSubmit={handleChapterUpload} className="space-y-6">
          {/* Card 3: Chapter Upload */}
          <div className="backdrop-blur-md bg-white/5 border border-white/10 rounded-3xl p-6 shadow-xl">
            <h2 className="text-lg font-bold mb-4 text-white/80 uppercase tracking-wider">Upload Chapter/Subject MCQs 📂</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Subject</label>
                <select 
                  value={chapterSubject} 
                  onChange={e => setChapterSubject(e.target.value)} 
                  className="w-full bg-[#0d0d12] border border-white/10 rounded-xl p-4 text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all outline-none appearance-none" 
                  required 
                >
                  <option value="Science">Science</option>
                  <option value="Mathematics">Mathematics</option>
                  <option value="Social Science">Social Science</option>
                  <option value="Hindi">Hindi</option>
                  <option value="Sanskrit">Sanskrit</option>
                  <option value="English">English</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Chapter Name</label>
                <input 
                  type="text" 
                  placeholder="e.g., Chemical Reactions" 
                  value={chapterName} 
                  onChange={e => setChapterName(e.target.value)} 
                  className="w-full bg-[#0d0d12] border border-white/10 rounded-xl p-4 text-white focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-all outline-none" 
                  required 
                />
              </div>
              
              <div className="border-2 border-dashed border-white/20 rounded-2xl p-8 text-center hover:border-blue-400/50 transition-colors bg-[#0d0d12]/50 relative group mt-4">
                <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                <p className="text-sm font-bold text-white/60 mb-2">Drag & Drop your CSV/Excel file here</p>
                <p className="text-xs text-white/40 mb-6">or click to browse from your device</p>
                
                <input 
                  type="file" 
                  accept=".csv, .xlsx" 
                  className="hidden" 
                  id="chapter-file-upload" 
                  onChange={e => setChapterFile(e.target.files?.[0] || null)} 
                  required 
                />
                <label 
                  htmlFor="chapter-file-upload" 
                  className="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl text-sm font-bold cursor-pointer transition-all active:scale-95"
                >
                  {chapterFile ? chapterFile.name : 'Choose File'}
                </label>
              </div>
            </div>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            disabled={isChapterUploading}
            className={`w-full py-5 rounded-2xl font-black text-lg uppercase tracking-widest transition-all ${
              isChapterUploading 
                ? 'bg-white/10 text-white/50 cursor-not-allowed' 
                : 'bg-blue-500 text-black shadow-[0_0_20px_rgba(59,130,246,0.4)] hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] active:scale-95'
            }`}
          >
            {isChapterUploading ? 'Saving...' : 'Upload Chapter Test to Database'}
          </button>
        </form>
      </div>
    </div>
  );
}