import { STATIC_COPILOT_URL } from '@/config'
import { CreditCardBrand } from '@/models/api'
import Image from 'next/image'
import { FC } from 'react'

interface CreditCardLogoProps {
  brand: CreditCardBrand
}

const CreditCardLogo: FC<CreditCardLogoProps> = ({ brand }) => (
  <Image
    src={`${STATIC_COPILOT_URL}/images/billing/${brand}.svg`}
    alt={brand}
    width={35}
    height={35}
  />
)

export default CreditCardLogo
