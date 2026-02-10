'use client'

import styles from './PhoneFrame.module.css'

function PhoneFrame({ children, style, className }) {
  return (
    <div
      className={`${styles.frame} ${className || ''}`}
      style={style}
    >
      {children}
    </div>
  )
}

export default PhoneFrame
