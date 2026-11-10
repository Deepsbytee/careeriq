import { useCallback, ReactNode } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, X, CheckCircle2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { Button } from './Button'
import { ProgressBar } from './Feedback'

interface FileUploadProps {
  onDrop: (files: File[]) => void
  accept?: Record<string, string[]>
  maxFiles?: number
  maxSize?: number
  disabled?: boolean
  progress?: number
  selectedFile?: File | null
  onRemove?: () => void
  success?: boolean
  className?: string
  hint?: string
}

export function FileUpload({
  onDrop,
  accept = {
    'application/pdf': ['.pdf'],
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
    'text/plain': ['.txt'],
  },
  maxFiles = 1,
  disabled,
  progress,
  selectedFile,
  onRemove,
  success,
  className,
  hint = 'PDF, DOCX, or TXT up to 5MB',
}: FileUploadProps) {
  const handleDrop = useCallback(
    (files: File[]) => onDrop(files),
    [onDrop]
  )

  const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
    onDrop: handleDrop,
    accept,
    maxFiles,
    disabled,
    noClick: !!selectedFile,
    noKeyboard: !!selectedFile,
  })

  return (
    <div className={cn('w-full', className)}>
      <div
        {...getRootProps()}
        className={cn(
          'relative rounded-2xl border-2 border-dashed transition-all duration-300 cursor-pointer overflow-hidden',
          isDragActive
            ? 'border-indigo-500 bg-indigo-500/10 scale-[1.01]'
            : success
              ? 'border-emerald-500/50 bg-emerald-500/5'
              : selectedFile
                ? 'border-indigo-500/40 bg-indigo-500/5'
                : 'border-border hover:border-indigo-500/40 hover:bg-surface-3/50'
        )}
      >
        <input {...getInputProps()} className="sr-only" />

        <AnimatePresence mode="wait">
          {selectedFile ? (
            <motion.div
              key="file"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-8 flex flex-col items-center gap-4"
            >
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/15 border border-indigo-500/30 flex items-center justify-center">
                {success ? (
                  <CheckCircle2 size={28} className="text-emerald-400" />
                ) : (
                  <FileText size={28} className="text-indigo-400" />
                )}
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-100 truncate max-w-xs">{selectedFile.name}</p>
                <p className="text-xs text-slate-500 mt-1">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
              {progress !== undefined && progress < 100 && (
                <div className="w-full max-w-xs">
                  <ProgressBar value={progress} showLabel />
                </div>
              )}
              {onRemove && !disabled && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<X size={14} />}
                  onClick={e => {
                    e.stopPropagation()
                    onRemove()
                  }}
                >
                  Remove file
                </Button>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="p-10 flex flex-col items-center gap-4 text-center"
            >
              <motion.div
                animate={isDragActive ? { scale: 1.1, rotate: 5 } : { scale: 1, rotate: 0 }}
                className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center"
              >
                <Upload size={28} className="text-indigo-400" />
              </motion.div>
              <div>
                <p className="font-semibold text-slate-100 mb-1">
                  {isDragActive ? 'Drop your file here' : 'Drag & drop your resume'}
                </p>
                <p className="text-sm text-slate-400">{hint}</p>
              </div>
              <Button
                variant="secondary"
                size="md"
                type="button"
                onClick={e => {
                  e.stopPropagation()
                  open()
                }}
              >
                Browse files
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
