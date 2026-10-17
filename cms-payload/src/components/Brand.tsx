/**
 * The admin's logo (login screen) and icon (nav), in the app's look: the lime
 * activity ring and the FitSyn wordmark in the system rounded face.
 */

const Ring = ({ size }: { size: number }) => (
  <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
    <circle cx="16" cy="16" r="12" fill="none" stroke="rgba(214,242,90,0.22)" strokeWidth="6" />
    <circle
      cx="16"
      cy="16"
      r="12"
      fill="none"
      stroke="#D6F25A"
      strokeWidth="6"
      strokeLinecap="round"
      strokeDasharray="56 76"
      transform="rotate(-90 16 16)"
    />
  </svg>
)

export const Logo = () => (
  <div className="fitsyn-logo">
    <Ring size={44} />
    <span>FitSyn</span>
  </div>
)

export const Icon = () => <Ring size={26} />
