'use client'

import { motion } from 'framer-motion'
import { MapPin, Navigation, Clock, ChevronRight } from 'lucide-react'
import Card from '@/components/Card'
import Layout from '@/components/Layout'

const styles = {
  container: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
  },
  content: {
    maxWidth: '1400px',
    margin: '0 auto',
  },
  pageTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(24px, 4vw, 32px)',
    fontWeight: '600',
    color: '#1a3d2e',
    textAlign: 'center',
    marginBottom: '24px',
  },
  mainLayout: {
    display: 'grid',
    gridTemplateColumns: '1fr',
    gap: '24px',
  },
  '@media (min-width: 900px)': {
    mainLayout: {
      gridTemplateColumns: '1fr 400px',
    },
  },
  mapContainer: {
    width: '100%',
    height: 'clamp(250px, 40vw, 450px)',
    background: 'linear-gradient(145deg, #e8e6e1 0%, #d4d2cd 100%)',
    borderRadius: '24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  mapGrid: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: 'grid',
    gridTemplateColumns: 'repeat(8, 1fr)',
    gridTemplateRows: 'repeat(6, 1fr)',
    opacity: 0.3,
  },
  mapGridLine: {
    border: '1px solid rgba(26, 61, 46, 0.1)',
  },
  mapPins: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  mapPin: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  },
  mapPinIcon: {
    width: '36px',
    height: '36px',
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
  },
  mapPinIconInner: {
    transform: 'rotate(45deg)',
  },
  userLocation: {
    position: 'absolute',
    width: '18px',
    height: '18px',
    borderRadius: '50%',
    background: '#3b82f6',
    border: '3px solid white',
    boxShadow: '0 2px 8px rgba(59, 130, 246, 0.5)',
  },
  mapLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    padding: '10px 20px',
    background: 'rgba(255, 255, 255, 0.9)',
    borderRadius: '14px',
    boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
    zIndex: 10,
  },
  mapLabelText: {
    fontSize: '16px',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  storeSection: {
    display: 'flex',
    flexDirection: 'column',
  },
  sectionTitle: {
    fontFamily: "'Cormorant Garamond', 'Noto Serif JP', serif",
    fontSize: 'clamp(18px, 3vw, 22px)',
    fontWeight: '600',
    color: '#1a3d2e',
    marginBottom: '16px',
  },
  storeList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  },
  storeCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    cursor: 'pointer',
  },
  storeIcon: {
    width: '56px',
    height: '56px',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  storeContent: {
    flex: 1,
  },
  storeHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '6px',
    flexWrap: 'wrap',
    gap: '8px',
  },
  storeName: {
    fontSize: 'clamp(15px, 2vw, 17px)',
    fontWeight: '600',
    color: '#1a3d2e',
  },
  storeDistance: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: 'clamp(13px, 1.8vw, 15px)',
    fontWeight: '600',
    color: '#c9a962',
  },
  storeAddress: {
    fontSize: 'clamp(13px, 1.8vw, 14px)',
    color: '#7f786d',
    marginBottom: '6px',
  },
  storeHours: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: 'clamp(12px, 1.6vw, 14px)',
    color: '#9c958a',
  },
  arrowIcon: {
    color: '#9c958a',
    flexShrink: 0,
  },
}

const stores = [
  {
    name: 'ライフ 〇〇店',
    address: '東京都渋谷区〇〇1-2-3',
    distance: '350m',
    hours: '9:00〜22:00',
    color: '#ef4444',
    bgColor: 'rgba(239, 68, 68, 0.12)',
    position: { top: '25%', left: '30%' },
  },
  {
    name: 'まいばすけっと △△店',
    address: '東京都渋谷区△△4-5-6',
    distance: '500m',
    hours: '8:00〜23:00',
    color: '#3b82f6',
    bgColor: 'rgba(59, 130, 246, 0.12)',
    position: { top: '40%', left: '65%' },
  },
  {
    name: 'オーケー □□店',
    address: '東京都渋谷区□□7-8-9',
    distance: '800m',
    hours: '10:00〜21:00',
    color: '#22c55e',
    bgColor: 'rgba(34, 197, 94, 0.12)',
    position: { top: '70%', left: '45%' },
  },
  {
    name: '成城石井 ◇◇店',
    address: '東京都渋谷区◇◇10-11-12',
    distance: '1.2km',
    hours: '10:00〜22:00',
    color: '#8b5cf6',
    bgColor: 'rgba(139, 92, 246, 0.12)',
    position: { top: '55%', left: '20%' },
  },
]

function NearbyStores() {
  // Detect if desktop for side-by-side layout
  const isDesktop = typeof window !== 'undefined' && window.innerWidth >= 900

  return (
    <Layout>
      <div style={styles.container}>
        <div style={styles.content}>
        <motion.h1
          style={styles.pageTitle}
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          近くの店舗
        </motion.h1>

        <div style={{
          ...styles.mainLayout,
          gridTemplateColumns: isDesktop ? '1fr 400px' : '1fr',
        }}>
          <motion.div
            style={styles.mapContainer}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <div style={styles.mapGrid}>
              {[...Array(48)].map((_, i) => (
                <div key={i} style={styles.mapGridLine} />
              ))}
            </div>

            <div style={styles.mapPins}>
              {/* User location */}
              <motion.div
                style={{ ...styles.userLocation, top: '50%', left: '50%', marginLeft: '-9px', marginTop: '-9px' }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.3, type: 'spring' }}
              />

              {/* Store pins */}
              {stores.map((store, index) => (
                <motion.div
                  key={store.name}
                  style={{ ...styles.mapPin, ...store.position }}
                  initial={{ scale: 0, y: -20 }}
                  animate={{ scale: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1, type: 'spring' }}
                >
                  <div style={{ ...styles.mapPinIcon, background: store.color }}>
                    <MapPin size={18} color="white" style={styles.mapPinIconInner} />
                  </div>
                </motion.div>
              ))}
            </div>

            <div style={styles.mapLabel}>
              <MapPin size={20} color="#1a3d2e" />
              <span style={styles.mapLabelText}>Map</span>
            </div>
          </motion.div>

          <div style={styles.storeSection}>
            <motion.h3
              style={styles.sectionTitle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
            >
              近くのスーパー・食料品店
            </motion.h3>

            <div style={styles.storeList}>
              {stores.map((store, index) => (
                <Card
                  key={store.name}
                  padding="md"
                  hoverable
                  delay={0.35 + index * 0.08}
                >
                  <div style={styles.storeCard}>
                    <div style={{ ...styles.storeIcon, background: store.bgColor }}>
                      <MapPin size={24} color={store.color} />
                    </div>
                    <div style={styles.storeContent}>
                      <div style={styles.storeHeader}>
                        <span style={styles.storeName}>{store.name}</span>
                        <span style={styles.storeDistance}>
                          <Navigation size={14} />
                          {store.distance}
                        </span>
                      </div>
                      <p style={styles.storeAddress}>{store.address}</p>
                      <div style={styles.storeHours}>
                        <Clock size={14} />
                        {store.hours}
                      </div>
                    </div>
                    <ChevronRight size={20} style={styles.arrowIcon} />
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
        </div>
      </div>
    </Layout>
  )
}

export default NearbyStores
