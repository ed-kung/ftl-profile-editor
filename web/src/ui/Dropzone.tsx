import { useRef, useState } from 'react'

interface DropzoneProps {
  /** Comma-separated accept list for the file input. */
  accept?: string
  heading: string
  hint: string
  disabled?: boolean
  onFile: (file: File) => void
}

/** A click-or-drag file picker. */
export function Dropzone({
  accept,
  heading,
  hint,
  disabled,
  onFile,
}: DropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)

  const take = (files: FileList | null) => {
    const file = files?.[0]
    if (file) onFile(file)
  }

  return (
    <div
      className={`dropzone${over ? ' is-over' : ''}`}
      role="button"
      tabIndex={0}
      aria-disabled={disabled}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => {
        if (disabled) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          inputRef.current?.click()
        }
      }}
      onDragOver={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        if (disabled) return
        e.preventDefault()
        setOver(false)
        take(e.dataTransfer.files)
      }}
    >
      <strong>{heading}</strong>
      <span>{hint}</span>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        accept={accept}
        disabled={disabled}
        onChange={(e) => {
          take(e.target.files)
          // Let the same file be re-picked after a failure.
          e.target.value = ''
        }}
      />
    </div>
  )
}
