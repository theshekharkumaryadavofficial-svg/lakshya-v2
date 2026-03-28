import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Trophy, Clock, CheckCircle, XCircle, MinusCircle, ChevronLeft, User } from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile } from '../App';

interface UniversalResultBoardProps {
  testId: string;
  score: number;
  totalQuestions: number;
  timeTaken: number;
  userAnswers: {
    questionId: string;
    questionText: string;
    userChoice: string | null;
    correctChoice: string;
  }[];
  testType: 'live' | 'normal';
  onClose: () => void;
  profile: UserProfile;
}

export function UniversalResultBoard({ testId, score, totalQuestions, timeTaken, userAnswers, testType, onClose, profile }: UniversalResultBoardProps) {
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [realTimeRank, setRealTimeRank] = useState<number | null>(null);

  useEffect(() => {
    const fetchRank = async () => {
      try {
        const q = query(
          collection(db, 'TestResults'),
          where('testId', '==', testId),
          orderBy('score', 'desc'),
          orderBy('timeTaken', 'asc')
        );
        const snap = await getDocs(q);
        let rank = 1;
        for (const doc of snap.docs) {
          if (doc.data().userId === profile.uid) {
            break;
          }
          rank++;
        }
        setRealTimeRank(rank);
      } catch (error) {
        console.error("Error calculating rank:", error);
      }
    };
    fetchRank();
  }, [testId, profile.uid]);

  useEffect(() => {
    const q = query(
      collection(db, 'TestResults'),
      where('testId', '==', testId),
      orderBy('score', 'desc'),
      orderBy('timeTaken', 'asc'),
      limit(10)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const results = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setLeaderboard(results);
    }, (error) => {
      console.error("Error fetching leaderboard:", error);
    });

    return () => unsubscribe();
  }, [testId]);

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const correctCount = userAnswers.filter(a => a.userChoice === a.correctChoice).length;
  const wrongCount = userAnswers.filter(a => a.userChoice !== null && a.userChoice !== a.correctChoice).length;
  const skippedCount = userAnswers.filter(a => a.userChoice === null).length;

  return (
    <div className="fixed inset-0 z-[999999] bg-[#050000] overflow-y-auto font-sans text-white">
      <div className="max-w-4xl mx-auto p-6 space-y-8">
        <button onClick={onClose} className="flex items-center gap-2 text-red-400 hover:text-red-300 transition-colors text-xs font-bold uppercase tracking-widest">
          <ChevronLeft className="w-4 h-4" />
          Back to Dashboard
        </button>

        <div className="text-center space-y-2">
          <h1 className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 uppercase tracking-tighter drop-shadow-[0_0_20px_rgba(239,68,68,0.5)]">
            Battle Results
          </h1>
          <p className="text-red-400/60 text-sm font-bold tracking-widest uppercase">Universal Analysis Board</p>
        </div>

        {/* SECTION 2A: Self Analysis */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="backdrop-blur-xl bg-red-950/20 border border-red-500/30 rounded-[2rem] p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <Trophy className="w-12 h-12 text-red-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" />
            <p className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{score}</p>
            <p className="text-xs text-red-400/60 uppercase font-bold tracking-widest mt-2">Total Score</p>
          </div>
          
          <div className="backdrop-blur-xl bg-red-950/20 border border-red-500/30 rounded-[2rem] p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.1)]">
            <Clock className="w-12 h-12 text-orange-500 mx-auto mb-4 drop-shadow-[0_0_15px_rgba(249,115,22,0.5)]" />
            <p className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{formatTime(timeTaken)}</p>
            <p className="text-xs text-orange-400/60 uppercase font-bold tracking-widest mt-2">Time Taken</p>
          </div>

          <div className="backdrop-blur-xl bg-red-950/20 border border-red-500/30 rounded-[2rem] p-8 text-center shadow-[0_0_30px_rgba(239,68,68,0.1)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4 border border-red-500/50">
                <span className="text-2xl font-black text-red-500">#</span>
              </div>
              <p className="text-5xl font-black text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">
                {realTimeRank !== null ? realTimeRank : '-'}
              </p>
              <p className="text-xs text-red-400/60 uppercase font-bold tracking-widest mt-2">Real-Time Rank</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-950/30 rounded-2xl p-4 border border-green-500/30 text-center">
            <CheckCircle className="w-6 h-6 text-green-500 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(34,197,94,0.5)]" />
            <p className="text-2xl font-black text-green-400">{correctCount}</p>
            <p className="text-[10px] text-green-400/60 uppercase font-bold tracking-widest">Correct</p>
          </div>
          <div className="bg-red-950/30 rounded-2xl p-4 border border-red-500/30 text-center">
            <XCircle className="w-6 h-6 text-red-500 mx-auto mb-2 drop-shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
            <p className="text-2xl font-black text-red-400">{wrongCount}</p>
            <p className="text-[10px] text-red-400/60 uppercase font-bold tracking-widest">Wrong</p>
          </div>
          <div className="bg-white/5 rounded-2xl p-4 border border-white/10 text-center">
            <MinusCircle className="w-6 h-6 text-white/40 mx-auto mb-2" />
            <p className="text-2xl font-black text-white/60">{skippedCount}</p>
            <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Skipped</p>
          </div>
        </div>

        {/* SECTION 2C & 2D: Top 10 Leaderboard */}
        {testType === 'live' || (testType === 'normal' && leaderboard.length > 0) ? (
          <div className="backdrop-blur-xl bg-red-950/10 border border-red-500/20 rounded-[2rem] p-6 md:p-8">
            <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-6 flex items-center gap-3">
              <Trophy className="w-6 h-6 text-red-500" />
              Top 10 Warriors
            </h2>
            <div className="space-y-3">
              {leaderboard.map((entry, idx) => {
                let rankColor = "text-white/60";
                let rankBg = "bg-white/5 border-white/10";
                let glow = "";
                
                if (idx === 0) {
                  rankColor = "text-yellow-400";
                  rankBg = "bg-yellow-500/10 border-yellow-500/30";
                  glow = "drop-shadow-[0_0_15px_rgba(250,204,21,0.5)]";
                } else if (idx === 1) {
                  rankColor = "text-gray-300";
                  rankBg = "bg-gray-400/10 border-gray-400/30";
                  glow = "drop-shadow-[0_0_15px_rgba(209,213,219,0.5)]";
                } else if (idx === 2) {
                  rankColor = "text-amber-600";
                  rankBg = "bg-amber-600/10 border-amber-600/30";
                  glow = "drop-shadow-[0_0_15px_rgba(217,119,6,0.5)]";
                }

                return (
                  <div key={entry.id} className={`flex items-center justify-between p-4 rounded-2xl border ${rankBg} transition-all`}>
                    <div className="flex items-center gap-4">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-black ${rankColor} ${glow}`}>
                        #{idx + 1}
                      </div>
                      <div className="w-10 h-10 rounded-full overflow-hidden bg-[#0d0d12] border border-white/10">
                        {entry.userPhoto ? (
                          <img src={entry.userPhoto} alt={entry.userName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : (
                          <User className="w-full h-full p-2 text-white/20" />
                        )}
                      </div>
                      <span className="font-bold text-white">{entry.userName}</span>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <p className="text-lg font-black text-red-400">{entry.score}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Score</p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-lg font-bold text-white/80">{formatTime(entry.timeTaken)}</p>
                        <p className="text-[10px] text-white/40 uppercase tracking-widest">Time</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {leaderboard.length === 0 && (
                <div className="text-center py-8 text-white/40 text-sm font-bold uppercase tracking-widest">
                  No warriors have completed this battle yet.
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* SECTION 2B: Error Analysis */}
        <div className="backdrop-blur-xl bg-red-950/10 border border-red-500/20 rounded-[2rem] p-6 md:p-8">
          <h2 className="text-2xl font-black text-white uppercase tracking-tighter mb-6">Battle Analysis</h2>
          <div className="space-y-4">
            {userAnswers.map((ans, idx) => {
              const isCorrect = ans.userChoice === ans.correctChoice;
              const isSkipped = ans.userChoice === null;
              
              let borderColor = "border-white/10";
              let bgColor = "bg-white/5";
              
              if (isCorrect) {
                borderColor = "border-green-500/50";
                bgColor = "bg-green-500/10";
              } else if (!isSkipped) {
                borderColor = "border-red-500/50";
                bgColor = "bg-red-500/10";
              }

              return (
                <div key={ans.questionId} className={`p-6 rounded-2xl border ${borderColor} ${bgColor}`}>
                  <div className="flex items-start gap-4">
                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center font-black text-white/60 shrink-0">
                      {idx + 1}
                    </div>
                    <div className="space-y-4 w-full">
                      <p className="text-lg font-medium text-white">{ans.questionText}</p>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Your Answer</p>
                          <div className={`p-3 rounded-xl border ${isSkipped ? 'border-white/10 text-white/40' : isCorrect ? 'border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]' : 'border-red-500/30 text-red-400 shadow-[0_0_15px_rgba(239,68,68,0.1)]'}`}>
                            {isSkipped ? 'Skipped' : ans.userChoice}
                          </div>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-[10px] text-white/40 uppercase font-bold tracking-widest">Correct Answer</p>
                          <div className="p-3 rounded-xl border border-green-500/30 text-green-400 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                            {ans.correctChoice}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
