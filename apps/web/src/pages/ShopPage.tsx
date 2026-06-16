import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  DEFAULT_HOUSE_ID,
  HOUSE_CATALOG,
  PLAYER_COLORS,
  formatCoinAmount,
  type HouseSkinId,
  type PlayerColor,
} from '@rune-race/shared'
import { useAuth } from '../hooks/useAuth'
import { usePlayerProfile } from '../hooks/usePlayerProfile'
import { useSkyPageName } from '../components/sky/useSkyPageName'
import { SkyPageLayout } from '../components/sky/SkyPageLayout'
import { SkyFormStage } from '../components/sky/SkyFormStage'
import { HousePreviewCanvas } from '../components/shop/HousePreviewCanvas'
import {
  equipHouse,
  fetchShopCatalog,
  fetchShopInventory,
  purchaseHouse,
  type ShopInventory,
} from '../lib/api'
import { supabase } from '../lib/supabase'

const COLOR_LABELS: Record<PlayerColor, string> = {
  red: 'Đỏ',
  blue: 'Xanh dương',
  green: 'Xanh lá',
  yellow: 'Vàng',
}

const HOUSE_ICONS: Record<HouseSkinId, string> = {
  house_default: 'bi-house-door-fill',
  house_cottage: 'bi-house-heart-fill',
  house_villa: 'bi-building-fill',
  house_manor: 'bi-bank2',
}

export default function ShopPage() {
  const { accessToken } = useAuth()
  const { refetch: refetchProfile } = usePlayerProfile()
  const { name, setName, onNameBlur } = useSkyPageName()
  const [catalog, setCatalog] = useState(() => Object.values(HOUSE_CATALOG))
  const [inventory, setInventory] = useState<ShopInventory | null>(null)
  const [selectedId, setSelectedId] = useState<HouseSkinId>(DEFAULT_HOUSE_ID)
  const [previewColor, setPreviewColor] = useState<PlayerColor>('red')
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!accessToken) {
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const [catalogRes, inventoryRes] = await Promise.all([
        fetchShopCatalog(),
        fetchShopInventory(accessToken),
      ])
      setCatalog(catalogRes.houses)
      setInventory(inventoryRes)
      setSelectedId(inventoryRes.equippedHouseId)
    } catch (err) {
      if (err instanceof Error && err.message === 'SESSION_EXPIRED') {
        await supabase.auth.signOut()
        setError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.')
        return
      }
      setError(err instanceof Error ? err.message : 'Không tải được cửa hàng')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    void load()
  }, [load])

  const selected = useMemo(
    () => catalog.find((item) => item.id === selectedId) ?? HOUSE_CATALOG[DEFAULT_HOUSE_ID],
    [catalog, selectedId],
  )

  const ownedSet = useMemo(
    () => new Set(inventory?.ownedHouseIds ?? [DEFAULT_HOUSE_ID]),
    [inventory?.ownedHouseIds],
  )

  const isOwned = ownedSet.has(selectedId)
  const isEquipped = inventory?.equippedHouseId === selectedId
  const canAfford = (inventory?.coins ?? 0) >= selected.price

  const handlePurchase = async () => {
    if (!accessToken || !inventory) return
    setActionLoading(true)
    setError(null)
    setNotice(null)
    try {
      const next = await purchaseHouse(accessToken, selectedId)
      setInventory(next)
      await refetchProfile()
      setNotice(`Đã mua ${selected.name}! Bấm "Trang bị" để dùng trên bàn cờ.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Mua thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  const handleEquip = async () => {
    if (!accessToken || !inventory) return
    setActionLoading(true)
    setError(null)
    setNotice(null)
    try {
      const next = await equipHouse(accessToken, selectedId)
      setInventory(next)
      await refetchProfile()
      setNotice(`Đã trang bị ${selected.name}.`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Trang bị thất bại')
    } finally {
      setActionLoading(false)
    }
  }

  return (
    <SkyPageLayout
      playerName={name}
      onPlayerNameChange={setName}
      onPlayerNameBlur={onNameBlur}
      topNavExtra={
        <Link to="/play" className="nav-btn">
          Chơi
        </Link>
      }
    >
      <SkyFormStage backTo="/play" backLabel="Quay lại" className="shop-form-stage">
        <div className="shop-shell panel p-yellow">
          <div className="shop-shell-head panel-head">
            <div className="panel-icon icon-yellow">
              <i className="bi bi-shop" aria-hidden="true" />
            </div>
            <div className="shop-shell-head-copy">
              <div className="panel-title">Cửa hàng nhà</div>
              <div className="panel-subtitle">Mua skin nhà hiển thị ở vùng đích trên bàn cờ</div>
            </div>
            {inventory ? (
              <div className="shop-balance-chip" aria-label="Số dư xu">
                <span className="shop-balance-chip__label">Số dư</span>
                <span className="shop-balance-chip__value">
                  {inventory.coins.toLocaleString('vi-VN')}
                  <span aria-hidden="true"> 🪙</span>
                </span>
              </div>
            ) : null}
          </div>

          <div className="shop-shell-body panel-body">
            {!accessToken ? (
              <div className="shop-auth-prompt">
                <p>Đăng nhập hoặc chơi ẩn danh để có profile — sau đó bạn có thể mua nhà tại đây.</p>
                <Link to="/auth/login" className="game-btn btn-green">
                  <span className="btn-icon">
                    <i className="bi bi-box-arrow-in-right" aria-hidden="true" />
                  </span>
                  <span>Đăng nhập</span>
                </Link>
              </div>
            ) : loading ? (
              <p className="shop-loading">Đang tải cửa hàng…</p>
            ) : (
              <div className="shop-layout">
                <aside className="shop-catalog" aria-label="Danh sách nhà">
                  <p className="shop-catalog-label">Bộ sưu tập</p>
                  <ul className="shop-house-list">
                    {catalog.map((house) => {
                      const owned = ownedSet.has(house.id)
                      const equipped = inventory?.equippedHouseId === house.id
                      const active = selectedId === house.id
                      return (
                        <li key={house.id}>
                          <button
                            type="button"
                            className={[
                              'shop-house-item',
                              active ? 'shop-house-item--active' : '',
                            ]
                              .filter(Boolean)
                              .join(' ')}
                            onClick={() => setSelectedId(house.id)}
                            aria-pressed={active}
                          >
                            <span className="shop-house-item__icon" aria-hidden="true">
                              <i className={`bi ${HOUSE_ICONS[house.id]}`} />
                            </span>
                            <span className="shop-house-item__copy">
                              <span className="shop-house-item__name">{house.name}</span>
                              <span className="shop-house-item__price">
                                {house.price === 0 ? 'Miễn phí' : formatCoinAmount(house.price)}
                              </span>
                            </span>
                            {equipped ? (
                              <span className="shop-house-item__badge shop-house-item__badge--equipped">
                                Đang dùng
                              </span>
                            ) : owned ? (
                              <span className="shop-house-item__badge shop-house-item__badge--owned">
                                Đã có
                              </span>
                            ) : null}
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </aside>

                <section className="shop-detail" aria-label="Chi tiết nhà">
                  <div className="shop-detail-panel">
                    <div className="shop-detail-info">
                      <div className="shop-detail-top">
                        <h2 className="shop-detail-title">{selected.name}</h2>
                        <p className="shop-detail-price">
                          {selected.price === 0 ? 'Miễn phí' : formatCoinAmount(selected.price)}
                        </p>
                      </div>
                      <p className="shop-detail-copy">{selected.description}</p>

                      <div className="shop-color-picker">
                        <span className="shop-color-picker__label">Màu quân trên bàn cờ</span>
                        <div className="shop-color-picker__options" role="group" aria-label="Màu xem trước">
                          {PLAYER_COLORS.map((color) => (
                            <button
                              key={color}
                              type="button"
                              className={[
                                'shop-color-swatch',
                                `shop-color-swatch--${color}`,
                                previewColor === color ? 'shop-color-swatch--active' : '',
                              ]
                                .filter(Boolean)
                                .join(' ')}
                              onClick={() => setPreviewColor(color)}
                              aria-label={COLOR_LABELS[color]}
                              aria-pressed={previewColor === color}
                              title={COLOR_LABELS[color]}
                            />
                          ))}
                        </div>
                      </div>

                      {error ? <div className="sky-alert-error shop-alert">{error}</div> : null}
                      {notice ? <div className="sky-alert-success shop-alert">{notice}</div> : null}

                      <div className="shop-actions">
                        {!isOwned && selected.price > 0 ? (
                          <button
                            type="button"
                            className="game-btn btn-green"
                            disabled={actionLoading || !canAfford}
                            onClick={() => void handlePurchase()}
                          >
                            <span className="btn-icon">
                              <i className="bi bi-cart-plus-fill" aria-hidden="true" />
                            </span>
                            <span>
                              Mua — {formatCoinAmount(selected.price)}
                            </span>
                          </button>
                        ) : null}
                        {isOwned && !isEquipped ? (
                          <button
                            type="button"
                            className="game-btn btn-blue"
                            disabled={actionLoading}
                            onClick={() => void handleEquip()}
                          >
                            <span className="btn-icon">
                              <i className="bi bi-check2-circle" aria-hidden="true" />
                            </span>
                            <span>Trang bị</span>
                          </button>
                        ) : null}
                        {isEquipped ? (
                          <span className="shop-equipped-badge">
                            <i className="bi bi-patch-check-fill" aria-hidden="true" /> Đang trang bị
                            trên bàn cờ
                          </span>
                        ) : null}
                        {!isOwned && selected.price > 0 && !canAfford ? (
                          <p className="shop-insufficient">Không đủ Xu — chơi thêm vài ván để tích lũy nhé.</p>
                        ) : null}
                      </div>
                    </div>

                    <div className="shop-detail-preview">
                      <p className="shop-preview-label">Xem trước 3D</p>
                      <HousePreviewCanvas skinId={selectedId} color={previewColor} />
                    </div>
                  </div>
                </section>
              </div>
            )}
          </div>
        </div>
      </SkyFormStage>
    </SkyPageLayout>
  )
}
