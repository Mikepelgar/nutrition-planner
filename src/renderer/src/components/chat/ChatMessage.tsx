import { AlertCircle } from 'lucide-react'
import type { ChatMessage as Msg } from '../../store/useChatStore'
import { Spinner } from '../ui/Spinner'
import { LogProposalCard } from './LogProposalCard'

interface Props {
  msg: Msg
  onGoToSettings?: () => void
}

export function ChatMessage({ msg, onGoToSettings }: Props) {
  const isUser = msg.role === 'user'

  if (msg.errorCode) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-2xl rounded-bl-sm px-4 py-2.5 text-sm bg-amber-950/60 border border-amber-800/50 text-amber-300">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <div>
              <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
              {(msg.errorCode === 'NOT_SIGNED_IN' || msg.errorCode === 'LIMIT_REACHED') &&
                onGoToSettings && (
                  <button
                    onClick={onGoToSettings}
                    className="mt-1.5 text-xs font-medium text-amber-400 hover:text-amber-200 underline underline-offset-2 transition-colors"
                  >
                    Open Settings →
                  </button>
                )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  // A reply can be only a proposal card (the model called the tool and wrote nothing).
  const showBubble = isUser || msg.streaming || msg.content.length > 0

  return (
    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
      {showBubble && (
        <div
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
            isUser
              ? 'bg-emerald-700 text-white rounded-br-sm'
              : 'bg-gray-800 text-gray-200 rounded-bl-sm'
          }`}
        >
          {msg.content || (msg.streaming ? <Spinner size={14} /> : null)}
          {msg.streaming && msg.content && (
            <span className="inline-block w-1.5 h-3.5 bg-gray-400 ml-0.5 animate-pulse rounded-sm align-text-bottom" />
          )}
        </div>
      )}
      {msg.proposal && (
        <LogProposalCard messageId={msg.id} proposal={msg.proposal} settledRows={msg.settledRows} />
      )}
    </div>
  )
}
