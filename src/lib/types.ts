/* ─── 경매장 ─── */
export interface AuctionItem {
  auctionNo: number;
  regDate: string;
  expireDate: string;
  itemId: string;
  itemName: string;
  itemAvailableLevel: number;
  itemRarity: string;
  itemTypeId: string;
  itemType: string;
  refine: number;
  reinforce: number;
  amplificationName?: string;
  fame?: number;
  currentPrice: number;
  unitPrice: number;
  averagePrice: number;
  count: number;
}

export interface AuctionSearchResponse {
  rows: AuctionItem[];
  error?: ApiError;
}

export interface AuctionDetailResponse extends AuctionItem {
  error?: ApiError;
}

export interface AuctionSoldItem {
  soldDate: string;
  itemId: string;
  itemName: string;
  itemAvailableLevel: number;
  itemRarity: string;
  itemTypeId: string;
  itemType: string;
  refine: number;
  reinforce: number;
  amplificationName?: string;
  count: number;
  price: number;
  unitPrice: number;
}

export interface AuctionSoldResponse {
  rows: AuctionSoldItem[];
  error?: ApiError;
}

/* ─── 아바타 마켓 ─── */
export interface AvatarMarketItem {
  goodsNo: number;
  sellerId: string;
  sellerName: string;
  regDate: string;
  expireDate: string;
  title: string;
  price: number;
  hashtag?: string[];
  count: number;
}

export interface AvatarMarketSearchResponse {
  rows: AvatarMarketItem[];
  error?: ApiError;
}

export interface AvatarMarketDetailResponse extends AvatarMarketItem {
  error?: ApiError;
}

export interface AvatarMarketSoldItem {
  goodsNo: number;
  soldDate: string;
  title: string;
  price: number;
  count: number;
  hashtag?: string[];
}

export interface AvatarMarketSoldResponse {
  rows: AvatarMarketSoldItem[];
  error?: ApiError;
}

export interface AvatarMarketHashtagResponse {
  rows: { hashtag: string; count: number }[];
  error?: ApiError;
}

/* ─── 아이템 ─── */
export interface ItemSearchResult {
  itemId: string;
  itemName: string;
  itemRarity: string;
  itemTypeId: string;
  itemType: string;
  itemAvailableLevel: number;
}

export interface ItemSearchResponse {
  rows: ItemSearchResult[];
  error?: ApiError;
}

export interface ItemDetailResponse {
  itemId: string;
  itemName: string;
  itemRarity: string;
  itemType: string;
  itemTypeDetail: string;
  itemAvailableLevel: number;
  itemExplain: string;
  itemFlavorText?: string;
  setItemId?: string;
  setItemName?: string;
  error?: ApiError;
}

export interface ItemShopInfo {
  shopName: string;
  price: number;
}

export interface ItemShopResponse {
  rows: ItemShopInfo[];
  error?: ApiError;
}

export interface ItemHashtagResponse {
  rows: { hashtag: string; count: number }[];
  error?: ApiError;
}

/* ─── 세트 아이템 ─── */
export interface SetItemResult {
  setItemId: string;
  setItemName: string;
}

export interface SetItemSearchResponse {
  rows: SetItemResult[];
  error?: ApiError;
}

/* ─── 시세 알림 ─── */
export interface AlertRule {
  id: string;
  email: string;
  itemName: string;
  targetPrice: number;
  condition: "below" | "above";
  createdAt: string;
  fulfilled: boolean;
}

export interface AlertRegisterRequest {
  email: string;
  itemName: string;
  targetPrice: number;
  condition: "below" | "above";
}

export interface AlertRegisterResponse {
  success: boolean;
  message: string;
  rule?: AlertRule;
  error?: ApiError;
}

export interface AlertListResponse {
  rules: AlertRule[];
  error?: ApiError;
}

/* ─── 인기 아이템 (조회수 기반) ─── */
export interface PopularItem {
  itemName: string;
  searchCount: number;
  lastPrice?: number;
  itemRarity?: string;
}

/* ─── 공통 ─── */
export interface ApiError {
  status?: number;
  code?: string;
  message: string;
}
