import {useEffect} from 'react'
import {useRouter} from 'expo-router'

export default function CreateRoute() {
  const router = useRouter()

  useEffect(() => {
    router.replace('/compose')
  }, [router])

  return null
}
