'use client'

const styles = {
  frame: {
    maxWidth: '1200px',
    margin: '0 auto',
    padding: '24px',
    width: '100%',
  },
}

function PhoneFrame({ children, style }) {
  return (
    <div style={{ ...styles.frame, ...(style || {}) }}>
      {children}
    </div>
  )
}

export default PhoneFrame
