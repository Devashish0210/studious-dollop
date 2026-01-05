import { STATIC_COPILOT_URL } from '@/config'
import Image from 'next/image'
import { FC, ReactNode } from 'react'

interface BackgroundPageLayoutProps {
  children: ReactNode
}

const BackgroundPageLayout: FC<BackgroundPageLayoutProps> = ({ children }) => (
  <div className="flex items-center justify-center min-h-screen relative">
    <Image
      src={`${STATIC_COPILOT_URL}/images/dh_background.png`}
      alt="Background"
      fill
      style={{ objectFit: 'cover', objectPosition: 'center' }}
      quality={100}
    />
    <div className="absolute w-full h-full flex items-center justify-center">
      {children}
    </div>
  </div>
)

export default BackgroundPageLayout
