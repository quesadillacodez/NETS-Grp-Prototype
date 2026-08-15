import { motion } from 'motion/react';
import { NETSLogo } from './NETSLogo';

export function StartupSplash() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100">
      <motion.div
        className="relative flex h-screen w-full max-w-[390px] flex-col items-center justify-center overflow-hidden bg-[#041b42] px-8 text-white"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.2 }}
      >
        <motion.div
          className="absolute -right-24 top-16 size-64 rounded-full border border-white/10"
          animate={{ rotate: 360, scale: [1, 1.08, 1] }}
          transition={{ rotate: { duration: 8, repeat: Infinity, ease: 'linear' }, scale: { duration: 2, repeat: Infinity } }}
        />
        <motion.div
          className="absolute -left-32 bottom-12 size-72 rounded-full border-[32px] border-[#0066ff]/20"
          animate={{ rotate: -360 }}
          transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
        />
        <motion.div
          className="absolute left-12 top-24 size-2 rounded-full bg-[#ef3340] shadow-[0_0_24px_8px_rgba(239,51,64,0.35)]"
          animate={{ opacity: [0.35, 1, 0.35], scale: [1, 1.6, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />

        <motion.div
          className="relative grid size-24 place-items-center rounded-[28px] bg-white shadow-[0_24px_70px_rgba(0,0,0,0.35)]"
          initial={{ scale: 0.72, opacity: 0, rotate: -6 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 180, damping: 16 }}
        >
          <div className="scale-125"><NETSLogo /></div>
          <motion.span
            className="absolute -right-1 -top-1 size-4 rounded-full border-[3px] border-[#041b42] bg-[#ef3340]"
            animate={{ scale: [0.8, 1.15, 0.8] }}
            transition={{ duration: 1.2, repeat: Infinity }}
          />
        </motion.div>

        <motion.div
          className="relative mt-8 text-center"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.45 }}
        >
          <p className="text-2xl font-black tracking-tight">Banking, made effortless.</p>
          <p className="mt-2 text-sm text-blue-100/75">Your money. Your moments. One secure place.</p>
        </motion.div>

        <div className="absolute bottom-16 w-40 overflow-hidden rounded-full bg-white/15">
          <motion.div
            className="h-1 rounded-full bg-gradient-to-r from-[#ef3340] to-[#4ba3ff]"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ duration: 1.45, ease: [0.22, 1, 0.36, 1] }}
          />
        </div>
        <p className="absolute bottom-8 text-[10px] font-bold uppercase tracking-[0.28em] text-white/45">
          Secured by NETS
        </p>
      </motion.div>
    </div>
  );
}
