/**
 * CanvasRenderer - 共享Canvas绘制工具类
 * 供掼蛋和麻将游戏板组件使用
 */
class CanvasRenderer {
  static COLORS = {
    FELT_GREEN: '#1a6b3c',
    FELT_DARK: '#0d4d2a',
    WOOD_LIGHT: '#D2691E',
    WOOD_DARK: '#8B4513',
    CARD_BACK_BLUE: '#1a237e',
    MAHJONG_GREEN: '#4CAF50',
    LABEL_BG: '#1a3a5c',
    BUTTON_BLUE: '#2196F3',
    BUTTON_ORANGE: '#FF9800',
    BUTTON_GREEN: '#4CAF50',
    BUTTON_RED: '#f44336',
  }

  constructor(canvas, options = {}) {
    this._imageCache = new Map()
    this._dpr = window.devicePixelRatio || 1
    this._canvas = null
    this._ctx = null
    this._logicalWidth = 0
    this._logicalHeight = 0
    if (canvas) {
      this.init(canvas, options)
    }
  }

  /**
   * 初始化，设置canvas尺寸（支持devicePixelRatio高清渲染）
   */
  init(canvas, options = {}) {
    this._canvas = canvas
    this._ctx = canvas.getContext('2d')
    this._dpr = options.dpr || window.devicePixelRatio || 1
    const width = options.width || canvas.clientWidth || 800
    const height = options.height || canvas.clientHeight || 600
    this._logicalWidth = width
    this._logicalHeight = height
    canvas.width = width * this._dpr
    canvas.height = height * this._dpr
    canvas.style.width = width + 'px'
    canvas.style.height = height + 'px'
    this._ctx.scale(this._dpr, this._dpr)
  }

  /**
   * 清除画布
   */
  clear() {
    this._ctx.save()
    this._ctx.setTransform(1, 0, 0, 1, 0, 0)
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height)
    this._ctx.restore()
  }

  /**
   * 绘制圆角矩形
   */
  drawRoundRect(x, y, w, h, radius = 8, fillColor, strokeColor, strokeWidth = 1) {
    const ctx = this._ctx
    ctx.save()
    ctx.beginPath()
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.arcTo(x + w, y, x + w, y + radius, radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
    ctx.lineTo(x + radius, y + h)
    ctx.arcTo(x, y + h, x, y + h - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()
    if (fillColor) {
      ctx.fillStyle = fillColor
      ctx.fill()
    }
    if (strokeColor) {
      ctx.strokeStyle = strokeColor
      ctx.lineWidth = strokeWidth
      ctx.stroke()
    }
    ctx.restore()
  }

  /**
   * 文字绘制
   */
  drawText(text, x, y, options = {}) {
    const ctx = this._ctx
    ctx.save()
    ctx.font = options.font || '14px sans-serif'
    ctx.fillStyle = options.color || '#000'
    ctx.textAlign = options.align || 'left'
    ctx.textBaseline = options.baseline || 'top'
    if (options.shadow) {
      ctx.shadowColor = options.shadow.color || 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = options.shadow.blur || 4
      ctx.shadowOffsetX = options.shadow.offsetX || 1
      ctx.shadowOffsetY = options.shadow.offsetY || 1
    }
    if (options.stroke) {
      ctx.strokeStyle = options.stroke.color || '#000'
      ctx.lineWidth = options.stroke.width || 2
      ctx.strokeText(text, x, y)
    }
    ctx.fillText(text, x, y)
    ctx.restore()
  }

  /**
   * 图片绘制
   */
  drawImage(img, x, y, w, h, options = {}) {
    const ctx = this._ctx
    ctx.save()
    if (options.circle) {
      const r = Math.min(w, h) / 2
      ctx.beginPath()
      ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2)
      ctx.closePath()
      ctx.clip()
    } else if (options.radius) {
      this._clipRoundRect(x, y, w, h, options.radius)
      ctx.clip()
    }
    ctx.drawImage(img, x, y, w, h)
    if (options.border) {
      ctx.strokeStyle = options.border.color || '#fff'
      ctx.lineWidth = options.border.width || 2
      if (options.circle) {
        const r = Math.min(w, h) / 2
        ctx.beginPath()
        ctx.arc(x + w / 2, y + h / 2, r, 0, Math.PI * 2)
        ctx.stroke()
      } else {
        ctx.strokeRect(x, y, w, h)
      }
    }
    ctx.restore()
  }

  /**
   * 异步加载图片，带缓存
   */
  loadImage(src) {
    if (this._imageCache.has(src)) {
      return Promise.resolve(this._imageCache.get(src))
    }
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        this._imageCache.set(src, img)
        resolve(img)
      }
      img.onerror = (err) => reject(err)
      img.src = src
    })
  }

  /**
   * 木质边框
   */
  drawWoodFrame(x, y, w, h, frameWidth = 12) {
    const ctx = this._ctx
    ctx.save()
    // 外框 - 木纹渐变
    const grad = ctx.createLinearGradient(x, y, x + w, y)
    grad.addColorStop(0, '#8B4513')
    grad.addColorStop(0.3, '#D2691E')
    grad.addColorStop(0.5, '#A0522D')
    grad.addColorStop(0.7, '#D2691E')
    grad.addColorStop(1, '#8B4513')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w, h)
    // 木纹纹理线条
    ctx.strokeStyle = 'rgba(0,0,0,0.1)'
    ctx.lineWidth = 0.5
    for (let i = 0; i < h; i += 4) {
      const wobble = Math.sin((i + w + h) * 0.08) * 0.8
      ctx.beginPath()
      ctx.moveTo(x, y + i)
      ctx.lineTo(x + w, y + i + wobble)
      ctx.stroke()
    }
    // 内部绿色区域
    const inner = frameWidth
    this.drawGreenFelt(x + inner, y + inner, w - inner * 2, h - inner * 2)
    // 内框阴影
    ctx.shadowColor = 'rgba(0,0,0,0.5)'
    ctx.shadowBlur = 6
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 2
    ctx.strokeRect(x + inner, y + inner, w - inner * 2, h - inner * 2)
    ctx.restore()
  }

  /**
   * 绿色毛毡背景
   */
  drawGreenFelt(x, y, w, h) {
    const ctx = this._ctx
    ctx.save()
    // 深绿色渐变
    const grad = ctx.createRadialGradient(
      x + w / 2, y + h / 2, 0,
      x + w / 2, y + h / 2, Math.max(w, h) / 2
    )
    grad.addColorStop(0, '#1a6b3c')
    grad.addColorStop(1, '#0d4d2a')
    ctx.fillStyle = grad
    ctx.fillRect(x, y, w, h)
    ctx.globalAlpha = 0.025
    ctx.fillStyle = '#fff'
    for (let py = y + 3; py < y + h; py += 18) {
      ctx.fillRect(x, py, w, 1)
    }
    ctx.fillStyle = '#000'
    for (let px = x + 7; px < x + w; px += 24) {
      ctx.fillRect(px, y, 1, h)
    }
    ctx.restore()
  }

  /**
   * 扑克牌背面
   */
  drawCardBack(x, y, w, h, options = {}) {
    const ctx = this._ctx
    ctx.save()
    const horizontal = options.horizontal || false
    // 牌面底色
    const grad = ctx.createLinearGradient(x, y, horizontal ? x + w : x, horizontal ? y : y + h)
    grad.addColorStop(0, '#1a237e')
    grad.addColorStop(0.5, '#283593')
    grad.addColorStop(1, '#1a237e')
    this.drawRoundRect(x, y, w, h, 4, null)
    ctx.beginPath()
    this._roundRectPath(x, y, w, h, 4)
    ctx.fillStyle = grad
    ctx.fill()
    // 白色边框
    ctx.strokeStyle = '#fff'
    ctx.lineWidth = 1
    ctx.stroke()
    // 内部装饰边框
    const inset = 3
    ctx.strokeStyle = 'rgba(255,255,255,0.3)'
    ctx.lineWidth = 0.5
    ctx.strokeRect(x + inset, y + inset, w - inset * 2, h - inset * 2)
    // 装饰花纹线条 - 菱形图案
    ctx.strokeStyle = 'rgba(255,255,255,0.15)'
    ctx.lineWidth = 0.5
    const cx = x + w / 2
    const cy = y + h / 2
    const dw = (w - inset * 4) / 2
    const dh = (h - inset * 4) / 2
    ctx.beginPath()
    ctx.moveTo(cx, cy - dh)
    ctx.lineTo(cx + dw, cy)
    ctx.lineTo(cx, cy + dh)
    ctx.lineTo(cx - dw, cy)
    ctx.closePath()
    ctx.stroke()
    // 中心小菱形
    ctx.beginPath()
    ctx.moveTo(cx, cy - dh * 0.4)
    ctx.lineTo(cx + dw * 0.4, cy)
    ctx.lineTo(cx, cy + dh * 0.4)
    ctx.lineTo(cx - dw * 0.4, cy)
    ctx.closePath()
    ctx.stroke()
    ctx.restore()
  }

  /**
   * 麻将牌背面（3D效果）
   */
  drawMahjongBack(x, y, w, h, options = {}) {
    const ctx = this._ctx
    ctx.save()
    const tilt = options.tilt !== false
    const horizontal = options.horizontal || false
    const depth = tilt ? 4 : 0
    // 侧面阴影（3D效果）
    if (tilt) {
      ctx.fillStyle = '#2E7D32'
      this._roundRectPath(x + 2, y + depth, w, h, 3)
      ctx.fill()
    }
    // 牌面主体 - 绿色渐变
    const grad = ctx.createLinearGradient(x, y, x, y + h)
    grad.addColorStop(0, '#66BB6A')
    grad.addColorStop(0.3, '#4CAF50')
    grad.addColorStop(1, '#388E3C')
    ctx.beginPath()
    this._roundRectPath(x, y, w, h - depth, 3)
    ctx.fillStyle = grad
    ctx.fill()
    // 顶面浅色高光
    if (tilt) {
      const topGrad = ctx.createLinearGradient(x, y, x, y + (h - depth) * 0.3)
      topGrad.addColorStop(0, 'rgba(255,255,255,0.3)')
      topGrad.addColorStop(1, 'rgba(255,255,255,0)')
      ctx.fillStyle = topGrad
      ctx.beginPath()
      this._roundRectPath(x, y, w, (h - depth) * 0.3, 3)
      ctx.fill()
    }
    // 边框
    ctx.strokeStyle = 'rgba(0,0,0,0.3)'
    ctx.lineWidth = 1
    ctx.beginPath()
    this._roundRectPath(x, y, w, h - depth, 3)
    ctx.stroke()
    // 中心圆形装饰
    const cx = x + w / 2
    const cy = y + (h - depth) / 2
    const r = Math.min(w, h - depth) * 0.2
    ctx.beginPath()
    ctx.arc(cx, cy, r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,0.15)'
    ctx.fill()
    ctx.restore()
  }

  /**
   * 座位信息绘制
   */
  drawSeatInfo(x, y, options = {}) {
    const ctx = this._ctx
    ctx.save()
    const { avatar, name = '', count, score, direction = 'bottom', isCurrentTurn = false, status = '' } = options
    const avatarSize = 40
    const labelPadX = 8
    const labelPadY = 4
    // 当前回合高亮
    if (isCurrentTurn) {
      ctx.shadowColor = '#FFD700'
      ctx.shadowBlur = 10
    }
    // 绘制圆形头像
    if (avatar && typeof avatar !== 'string') {
      this.drawImage(avatar, x, y, avatarSize, avatarSize, { circle: true, border: { color: isCurrentTurn ? '#FFD700' : '#fff', width: 2 } })
    } else {
      // 占位头像
      ctx.beginPath()
      ctx.arc(x + avatarSize / 2, y + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2)
      ctx.fillStyle = '#546E7A'
      ctx.fill()
      ctx.strokeStyle = isCurrentTurn ? '#FFD700' : '#fff'
      ctx.lineWidth = 2
      ctx.stroke()
      // 默认头像图标
      ctx.fillStyle = '#B0BEC5'
      ctx.beginPath()
      ctx.arc(x + avatarSize / 2, y + avatarSize * 0.35, avatarSize * 0.18, 0, Math.PI * 2)
      ctx.fill()
      ctx.beginPath()
      ctx.arc(x + avatarSize / 2, y + avatarSize * 0.85, avatarSize * 0.28, Math.PI, 0)
      ctx.fill()
    }
    ctx.shadowBlur = 0
    // 名称标签
    const labelY = y + avatarSize + 6
    ctx.font = 'bold 12px sans-serif'
    const textWidth = ctx.measureText(name).width
    const labelW = Math.max(textWidth + labelPadX * 2, avatarSize)
    const labelX = x + (avatarSize - labelW) / 2
    this.drawRoundRect(labelX, labelY, labelW, 18, 9, CanvasRenderer.COLORS.LABEL_BG)
    this.drawText(name, x + avatarSize / 2, labelY + labelPadY, {
      font: 'bold 11px sans-serif',
      color: '#fff',
      align: 'center',
      baseline: 'top'
    })
    // 张数/分数
    const infoY = labelY + 22
    const infoText = count !== undefined ? `${count}张` : (score !== undefined ? `${score}分` : '')
    if (infoText) {
      this.drawText(infoText, x + avatarSize / 2, infoY, {
        font: '11px sans-serif',
        color: '#ccc',
        align: 'center',
        baseline: 'top'
      })
    }
    if (status) {
      const statusY = infoY + (infoText ? 16 : 0)
      ctx.font = 'bold 10px sans-serif'
      const statusW = Math.max(ctx.measureText(status).width + 12, 34)
      const statusX = x + (avatarSize - statusW) / 2
      this.drawRoundRect(statusX, statusY, statusW, 16, 8, 'rgba(255, 87, 87, 0.92)', 'rgba(255,255,255,0.42)', 1)
      this.drawText(status, x + avatarSize / 2, statusY + 3, {
        font: 'bold 10px sans-serif',
        color: '#fff',
        align: 'center',
        baseline: 'top'
      })
    }
    ctx.restore()
  }

  /**
   * 绘制出牌区域
   */
  drawPlayedCards(x, y, cards = [], options = {}) {
    const ctx = this._ctx
    ctx.save()
    const { label = '', title = '' } = options
    const cardW = 36
    const cardH = 52
    const gap = 4
    const panelPadding = 12
    const totalCardsW = cards.length * (cardW + gap) - gap
    const panelW = Math.max(totalCardsW + panelPadding * 2, 120)
    const panelH = cardH + panelPadding * 2 + (title ? 22 : 0) + (label ? 20 : 0)
    // 白色圆角面板背景
    this.drawRoundRect(x, y, panelW, panelH, 8, 'rgba(255,255,255,0.9)')
    let offsetY = y + panelPadding
    // 标题
    if (title) {
      this.drawText(title, x + panelW / 2, offsetY, {
        font: 'bold 12px sans-serif',
        color: '#333',
        align: 'center',
        baseline: 'top'
      })
      offsetY += 22
    }
    // 扑克牌面
    const startX = x + (panelW - totalCardsW) / 2
    cards.forEach((card, i) => {
      const cx = startX + i * (cardW + gap)
      this._drawCardFace(cx, offsetY, cardW, cardH, card)
    })
    offsetY += cardH
    // 牌型标签
    if (label) {
      offsetY += 6
      this.drawText(label, x + panelW / 2, offsetY, {
        font: 'bold 11px sans-serif',
        color: '#e65100',
        align: 'center',
        baseline: 'top'
      })
    }
    ctx.restore()
  }

  /**
   * 绘制麻将牌面（使用图片）
   */
  drawMahjongTileFace(x, y, w, h, tile = {}, imageUrl = null) {
    const ctx = this._ctx
    ctx.save()
    
    // 白色底色
    this.drawRoundRect(x, y, w, h, 3, '#FFFFFF', '#d0d0d0', 1)
    
    // 如果有图片URL，使用图片渲染
    if (imageUrl) {
      const img = this._imageCache.get(imageUrl)
      if (img && img.complete) {
        // 圆角裁剪
        ctx.beginPath()
        this._roundRectPath(x, y, w, h, 3)
        ctx.closePath()
        ctx.clip()
        
        // 绘制图片（留出边距）
        const padding = 2
        ctx.drawImage(img, x + padding, y + padding, w - padding * 2, h - padding * 2)
        
        ctx.restore()
        return
      }
    }
    
    // 如果没有图片或图片未加载，使用原来的白色背景+文字方式
    // 顶部阴影
    const shadowGrad = ctx.createLinearGradient(x, y, x, y + h * 0.15)
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.08)')
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = shadowGrad
    ctx.fillRect(x + 1, y + 1, w - 2, h * 0.15)
    // 文字/花色标识
    const { suit, rank } = tile
    let display = ''
    let color = '#333'
    if (suit === 'man' || suit === 'wan') {
      display = rank ? `${rank}万` : '万'
      color = '#d32f2f'
    } else if (suit === 'pin' || suit === 'tong') {
      display = rank ? `${rank}筒` : '筒'
      color = '#1565C0'
    } else if (suit === 'sou' || suit === 'tiao') {
      display = rank ? `${rank}条` : '条'
      color = '#2E7D32'
    } else if (suit === 'wind') {
      const winds = { 1: '东', 2: '南', 3: '西', 4: '北' }
      display = winds[rank] || '风'
      color = '#333'
    } else if (suit === 'dragon') {
      const dragons = { 1: '中', 2: '发', 3: '白' }
      display = dragons[rank] || ''
      color = rank === 1 ? '#d32f2f' : (rank === 2 ? '#2E7D32' : '#333')
    } else if (suit === 'zhong') {
      display = '中'
      color = '#d32f2f'
    } else {
      display = `${rank || ''}`
    }
    const fontSize = Math.min(w * 0.5, h * 0.35)
    this.drawText(display, x + w / 2, y + h / 2, {
      font: `bold ${fontSize}px serif`,
      color,
      align: 'center',
      baseline: 'middle'
    })
    ctx.restore()
  }

  /**
   * 绘制弃牌区
   */
  drawDiscardArea(x, y, tiles = [], direction = 'horizontal') {
    const ctx = this._ctx
    ctx.save()
    const tileW = 28
    const tileH = 36
    const gap = 2
    const cols = 6
    tiles.forEach((tile, i) => {
      let tx, ty
      if (direction === 'horizontal') {
        const row = Math.floor(i / cols)
        const col = i % cols
        tx = x + col * (tileW + gap)
        ty = y + row * (tileH + gap)
      } else {
        const col = Math.floor(i / cols)
        const row = i % cols
        tx = x + col * (tileW + gap)
        ty = y + row * (tileH + gap)
      }
      this.drawMahjongTileFace(tx, ty, tileW, tileH, tile)
    })
    ctx.restore()
  }

  /**
   * 绘制倒计时圆环
   */
  drawTimer(x, y, radius = 20, seconds = 0, maxSeconds = 30) {
    const ctx = this._ctx
    ctx.save()
    const progress = Math.max(0, Math.min(1, seconds / maxSeconds))
    // 背景圆环
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fill()
    // 进度环
    ctx.beginPath()
    ctx.arc(x, y, radius - 3, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * progress)
    ctx.strokeStyle = progress > 0.3 ? '#4CAF50' : '#f44336'
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.stroke()
    // 中间数字
    this.drawText(String(Math.ceil(seconds)), x, y, {
      font: `bold ${radius * 0.8}px sans-serif`,
      color: '#fff',
      align: 'center',
      baseline: 'middle'
    })
    ctx.restore()
  }

  // ============ 辅助方法 ============

  /**
   * 获取当前缩放比例
   */
  getScale() {
    return this._dpr
  }

  /**
   * 调整canvas尺寸
   */
  resize(width, height) {
    this._logicalWidth = width
    this._logicalHeight = height
    this._canvas.width = width * this._dpr
    this._canvas.height = height * this._dpr
    this._canvas.style.width = width + 'px'
    this._canvas.style.height = height + 'px'
    this._ctx.scale(this._dpr, this._dpr)
  }

  /**
   * 获取花色符号
   */
  getCardSuitSymbol(suit) {
    const map = {
      spade: '♠', spades: '♠', S: '♠',
      heart: '♥', hearts: '♥', H: '♥',
      diamond: '♦', diamonds: '♦', D: '♦',
      club: '♣', clubs: '♣', C: '♣',
      joker: '★',
    }
    return map[suit] || suit
  }

  /**
   * 获取花色颜色
   */
  getCardSuitColor(suit) {
    const reds = ['heart', 'hearts', 'H', 'diamond', 'diamonds', 'D']
    return reds.includes(suit) ? '#d32f2f' : '#222'
  }

  // ============ 私有方法 ============

  _clipRoundRect(x, y, w, h, radius) {
    const ctx = this._ctx
    ctx.beginPath()
    this._roundRectPath(x, y, w, h, radius)
    ctx.closePath()
  }

  _roundRectPath(x, y, w, h, radius) {
    const ctx = this._ctx
    ctx.moveTo(x + radius, y)
    ctx.lineTo(x + w - radius, y)
    ctx.arcTo(x + w, y, x + w, y + radius, radius)
    ctx.lineTo(x + w, y + h - radius)
    ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
    ctx.lineTo(x + radius, y + h)
    ctx.arcTo(x, y + h, x, y + h - radius, radius)
    ctx.lineTo(x, y + radius)
    ctx.arcTo(x, y, x + radius, y, radius)
    ctx.closePath()
  }

  _drawCardFace(x, y, w, h, card = {}) {
    const ctx = this._ctx
    ctx.save()
    // 白色牌面
    this.drawRoundRect(x, y, w, h, 3, '#fff', '#aaa', 1)
    const { suit, rank } = card
    if (suit === 'joker' || rank === 'SJ' || rank === 'BJ') {
      const isBig = rank === 'BJ'
      const color = isBig ? '#d32f2f' : '#222'
      const bg = ctx.createLinearGradient(x, y, x, y + h)
      bg.addColorStop(0, isBig ? '#fff1f1' : '#f3f3f5')
      bg.addColorStop(1, isBig ? '#ffe1e1' : '#e2e2e6')
      this.drawRoundRect(x, y, w, h, 3, bg, 'rgba(164, 190, 230, 0.65)', 1)

      const cornerSize = Math.max(6, Math.min(w * 0.2, 9))
      const iconScale = Math.min(w / 40, h / 50) * 0.5
      const iconW = 40 * iconScale
      const iconH = 50 * iconScale
      const iconX = x + (w - iconW) / 2
      const iconY = y + (h - iconH) / 2 + 1

      this.drawText('JOKER', x + w / 2, y + 5, {
        font: `bold ${cornerSize}px Georgia, "Times New Roman", serif`,
        color,
        align: 'center',
        baseline: 'top'
      })
      drawCanvasJokerIcon(ctx, iconX, iconY, iconScale, color)
      ctx.save()
      ctx.translate(x + w / 2, y + h - 5)
      ctx.rotate(Math.PI)
      this.drawText('JOKER', 0, 0, {
        font: `bold ${cornerSize}px Georgia, "Times New Roman", serif`,
        color,
        align: 'center',
        baseline: 'top'
      })
      ctx.restore()
      return
    }
    const symbol = this.getCardSuitSymbol(suit)
    const color = this.getCardSuitColor(suit)
    // 左上角花色和点数
    const fontSize = Math.min(w * 0.35, 14)
    this.drawText(rank || '', x + 4, y + 3, {
      font: `bold ${fontSize}px sans-serif`,
      color,
      baseline: 'top'
    })
    this.drawText(symbol, x + 4, y + 3 + fontSize + 1, {
      font: `${fontSize * 0.85}px sans-serif`,
      color,
      baseline: 'top'
    })
    // 中心大花色
    const centerSize = Math.min(w * 0.5, 20)
    this.drawText(symbol, x + w / 2, y + h / 2, {
      font: `${centerSize}px sans-serif`,
      color,
      align: 'center',
      baseline: 'middle'
    })
    ctx.restore()
  }
}

export default CanvasRenderer

function drawCanvasJokerIcon(ctx, x, y, scale, color) {
  const p = (v) => v * scale
  ctx.save()
  ctx.translate(x, y)
  ctx.fillStyle = color
  ctx.strokeStyle = color
  ctx.lineWidth = Math.max(0.5, p(0.8))

  ctx.beginPath()
  ctx.moveTo(p(7), p(27))
  ctx.lineTo(p(3), p(9))
  ctx.lineTo(p(14), p(27))
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p(14), p(27))
  ctx.lineTo(p(20), p(2))
  ctx.lineTo(p(26), p(27))
  ctx.closePath()
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p(26), p(27))
  ctx.lineTo(p(37), p(9))
  ctx.lineTo(p(33), p(27))
  ctx.closePath()
  ctx.fill()

  roundRectPath(ctx, p(4.5), p(25.5), p(31), p(5.2), p(2.2))
  ctx.fill()

  ;[[3, 9], [20, 2.4], [37, 9]].forEach(([cx, cy]) => {
    ctx.beginPath()
    ctx.arc(p(cx), p(cy), p(2.3), 0, Math.PI * 2)
    ctx.fillStyle = '#ffd95a'
    ctx.fill()
    ctx.strokeStyle = color
    ctx.stroke()
  })

  ctx.fillStyle = '#ffe2c2'
  ctx.beginPath()
  ctx.arc(p(20), p(39), p(6.2), 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = color
  ctx.stroke()

  ctx.fillStyle = color
  ctx.beginPath()
  ctx.arc(p(17.4), p(38), p(0.85), 0, Math.PI * 2)
  ctx.arc(p(22.6), p(38), p(0.85), 0, Math.PI * 2)
  ctx.fill()

  ctx.beginPath()
  ctx.moveTo(p(16.2), p(41.2))
  ctx.quadraticCurveTo(p(20), p(44.2), p(23.8), p(41.2))
  ctx.stroke()

  ctx.globalAlpha = 0.7
  ctx.beginPath()
  ctx.arc(p(13.6), p(41), p(0.7), 0, Math.PI * 2)
  ctx.arc(p(26.4), p(41), p(0.7), 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

function roundRectPath(ctx, x, y, w, h, radius) {
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.lineTo(x + w - radius, y)
  ctx.arcTo(x + w, y, x + w, y + radius, radius)
  ctx.lineTo(x + w, y + h - radius)
  ctx.arcTo(x + w, y + h, x + w - radius, y + h, radius)
  ctx.lineTo(x + radius, y + h)
  ctx.arcTo(x, y + h, x, y + h - radius, radius)
  ctx.lineTo(x, y + radius)
  ctx.arcTo(x, y, x + radius, y, radius)
  ctx.closePath()
}
