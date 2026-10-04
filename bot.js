const mineflayer = require('mineflayer')
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder')
const pvp = require('mineflayer-pvp').plugin

// إعدادات الاتصال بالسيرفر
const bot = mineflayer.createBot({
  host: 'mmmoh22.aternos.me',
  port: 64579,
  username: 'ProBot'
})

// تحميل الإضافات
bot.loadPlugin(pathfinder)
bot.loadPlugin(pvp)

bot.on('spawn', () => {
  console.log('تم دخول البوت بنجاح! البوت جاهز ومُجهز بالذكاء التلقائي.')
  const defaultMove = new Movements(bot)
  bot.pathfinder.setMovements(defaultMove)
})

// ==========================================
// 1. نظام النجاة والدفاع التلقائي عند تلقي الضرر
// ==========================================
bot.on('entityHurt', async (entity) => {
  if (entity !== bot.entity) return

  // أ) النجاة من الحرق أو اللافا
  if (bot.entity.isInLava || bot.entity.isOnFire) {
    bot.chat('أنا أحترق! أحاول النجاة للوصول للماء أو الابتعاد...')
    bot.setControlState('jump', true)
    bot.setControlState('forward', true)
    setTimeout(() => {
      bot.clearControlStates()
    }, 2000)
    return
  }

  // ب) النجاة من الغرق
  if (bot.entity.isInWater) {
    bot.chat('أنا أغرق! أسبح للأعلى...')
    bot.setControlState('jump', true)
    return
  }

  // ج) الدفاع التلقائي ضد الوحوش والمهاجمين
  const attacker = bot.nearestEntity((e) => {
    return (e.type === 'mob' || e.type === 'hostile' || e.type === 'player') &&
           e.position.distanceTo(bot.entity.position) < 8 &&
           e !== bot.entity
  })

  if (attacker) {
    bot.chat('تعرضت للهجوم! أدافع عن نفسي الآن...')
    await equipBestWeapon()
    bot.pvp.attack(attacker)
  }
})

// ==========================================
// 2. استلام الأوامر من الشات
// ==========================================
bot.on('chat', async (username, message) => {
  if (username === bot.username) return

  const args = message.split(' ')
  const command = args[0]

  // أمر فحص الحقيبة
  if (command === 'حقيبة' || command === 'inventory') {
    checkInventory()
    return
  }

  // أمر رمي العناصر: ارمي [اسم_العنصر]
  if (command === 'ارمي' && args.length >= 2) {
    const itemName = args[1].toLowerCase()
    await dropItem(itemName)
    return
  }

  // أمر البحث عن الدايموند
  if (command === 'دايموند' || command === 'diamond') {
    bot.chat('جاري البحث عن أقرب بلوكة دايموند...')
    await collectResource(['diamond_ore', 'deepslate_diamond_ore'], 'دايموند')
    return
  }

  // أمر البحث عن النذرايت
  if (command === 'نذرايت' || command === 'netherite') {
    bot.chat('جاري المسح للبحث عن نذرايت...')
    await collectResource(['ancient_debris'], 'نذرايت')
    return
  }

  // أمر الحماية المخصصة لمنطقة محدودة
  if (command === 'حماية' && args.length >= 7) {
    const minX = Math.min(parseInt(args[1]), parseInt(args[4]))
    const maxX = Math.max(parseInt(args[1]), parseInt(args[4]))
    const minY = Math.min(parseInt(args[2]), parseInt(args[5]))
    const maxY = Math.max(parseInt(args[2]), parseInt(args[5]))
    const minZ = Math.min(parseInt(args[3]), parseInt(args[6]))
    const maxZ = Math.max(parseInt(args[3]), parseInt(args[6]))

    bot.chat('تم تفعيل وضع الحماية المخصصة في المنطقة!')
    protectZone(minX, maxX, minY, maxY, minZ, maxZ)
    return
  }
})

// ==========================================
// 3. دوال التجهيز الذكي للأسلحة والأدوات
// ==========================================

// تجهيز أفضل سيف عند القتال
async function equipBestWeapon() {
  const sword = bot.inventory.items().find(i => i.name.includes('sword'))
  if (sword) {
    try {
      await bot.equip(sword, 'hand')
    } catch (err) {}
  }
}

// تجهيز البيككس المناسب عند التعدين
async function equipBestPickaxe() {
  const pickaxe = bot.inventory.items().find(i => i.name.includes('pickaxe'))
  if (pickaxe) {
    try {
      await bot.equip(pickaxe, 'hand')
    } catch (err) {}
  }
}

// ==========================================
// 4. الدوال التنفيذية العامة
// ==========================================

// دالة التعدين والكسر الذكية
async function collectResource(blockNames, resourceLabel) {
  const targetBlock = bot.findBlock({
    matching: (b) => blockNames.includes(b.name),
    maxDistance: 64
  })

  if (!targetBlock) {
    bot.chat('لم أجد أي ' + resourceLabel + ' في نطاق 64 بلوكة.')
    return
  }

  const pos = targetBlock.position
  bot.chat('وجدت ' + resourceLabel + ' في X:' + pos.x + ' Y:' + pos.y + ' Z:' + pos.z + '! جاري التحرك...')

  bot.pathfinder.setGoal(new goals.GoalBlock(pos.x, pos.y, pos.z))

  bot.once('goal_reached', async () => {
    try {
      // تجهيز البيككس قبل الحفر
      await equipBestPickaxe()
      await bot.dig(targetBlock)
      bot.chat('تم جمع الـ ' + resourceLabel + ' بنجاح!')
    } catch (err) {
      bot.chat('حدث خطأ أثناء التعدين.')
    }
  })
}

// دالة فحص الحقيبة
function checkInventory() {
  const items = bot.inventory.items()
  if (items.length === 0) {
    bot.chat('الحقيبة فارغة حالياً!')
    return
  }
  const itemList = items.map(i => i.name + ' x' + i.count).join(', ')
  bot.chat('محتويات الحقيبة: ' + itemList)
}

// دالة رمي الأغراض
async function dropItem(itemName) {
  const item = bot.inventory.items().find(i => i.name.includes(itemName))
  if (!item) {
    bot.chat('ليس لدي أي ' + itemName + ' في الحقيبة!')
    return
  }
  try {
    await bot.tossStack(item)
    bot.chat('تفضل! تم رمي ' + item.count + ' من ' + item.name)
  } catch (err) {
    bot.chat('حدث خطأ أثناء الرمي.')
  }
}

// دالة حماية منطقة محددة
function protectZone(minX, maxX, minY, maxY, minZ, maxZ) {
  const centerX = Math.floor((minX + maxX) / 2)
  const centerY = Math.floor((minY + maxY) / 2)
  const centerZ = Math.floor((minZ + maxZ) / 2)

  bot.pathfinder.setGoal(new goals.GoalBlock(centerX, centerY, centerZ))

  const interval = setInterval(async () => {
    if (!bot || !bot.entity) {
      clearInterval(interval)
      return
    }

    const target = bot.nearestEntity((e) => {
      if (!e || !e.position) return false
      const isMob = e.type === 'mob' || e.type === 'hostile'
      const inBounds = 
        e.position.x >= minX - 2 && e.position.x <= maxX + 2 &&
        e.position.y >= minY - 2 && e.position.y <= maxY + 2 &&
        e.position.z >= minZ - 2 && e.position.z <= maxZ + 2

      return isMob && inBounds && e.isValid
    })

    if (target) {
      await equipBestWeapon()
      bot.pvp.attack(target)
    }
  }, 500)
}