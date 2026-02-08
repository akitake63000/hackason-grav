'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

function NearbyStores() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/feature3/food-recommend')
  }, [router])

  return null
}

export default NearbyStores
