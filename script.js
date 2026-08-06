/* ===================== DOM ===================== */
const productGrid  = document.getElementById("productGrid");
const favoriteGrid = document.getElementById("favoriteGrid");
const favoritesEmpty = document.getElementById("favoritesEmpty");
const imageModal   = document.getElementById("imageModal");
const modalImage   = document.getElementById("modalImage");
const closeModal   = document.getElementById("closeModal");
const searchInput  = document.getElementById("searchInput");
const backToTop    = document.getElementById("backToTop");
const hamburger    = document.getElementById("hamburger");
const mainNav      = document.getElementById("mainNav");

/* Cart DOM */
const cartBtn      = document.getElementById("cartBtn");
const cartCount    = document.getElementById("cartCount");
const cartDrawer   = document.getElementById("cartDrawer");
const cartOverlay  = document.getElementById("cartOverlay");
const cartClose    = document.getElementById("cartClose");
const cartItemsEl  = document.getElementById("cartItems");
const cartEmptyEl  = document.getElementById("cartEmpty");
const cartFooter   = document.getElementById("cartFooter");
const cartTotalEl  = document.getElementById("cartTotal");
const cartCheckout = document.getElementById("cartCheckout");
const cartClear    = document.getElementById("cartClear");

let favorites   = JSON.parse(localStorage.getItem("favorites")) || [];
let currentLang = "ar"; /* الموقع بقى عربي بس، من غير خيار تبديل اللغة */
let productRatings = JSON.parse(localStorage.getItem("productRatings")) || {};
let cart        = JSON.parse(localStorage.getItem("cart")) || [];

/* ===================== إعدادات الدفع ===================== */
const PAYMENT_INFO = {
    wallet:   { number: "01154548913", note: "حوّلي المبلغ على رقم اتصالات كاش ده وابعتي إسكرين شوت للعميل عبر واتساب بعد الطلب" },
    instapay: { handle: "01288127665", note: "حوّلي المبلغ على إنستاباي بالرقم ده وابعتي إسكرين شوت للعميل عبر واتساب بعد الطلب" }
};

let SITE = {
    whatsapp_number: "01288127665",
    free_shipping_min: 500,
    wallet_number: "01154548913",
    instapay_handle: "01288127665",
    announcement: "🎁 شحن مجاني للطلبات فوق 500 جنيه  ·  ✨ تصميمات هاند ميد حصرية  ·  🛍️ اطلبِي بسهولة",
    telegram_bot_token: "",
    telegram_chat_id: "",
    hero_badge: "تصميمات يدوية فخمة",
    hero_title: "تفاصيل صغيرة تصنع بيتًا أكثر جمالًا",
    hero_text: "مكرمية، خيش، مرايات مزينة، وقطع ديكور مصنوعة بحب لتضيف لمسة أنيقة لكل ركن في منزلك.",
    hero_btn: "شاهدي المنتجات",
    hero_image: "",
    thankyou_title: "طلبكِ وصلنا بنجاح 🎁",
    thankyou_message: "شكرًا لثقتكِ فينا. هنراجع طلبكِ وهنتواصل معاكي قريب لتأكيد التفاصيل. كل قطعة بتتعمل بحب ❤️"
};

let appliedCoupon = null; // { code, discount_type, discount_value, discount_amount }

function applySiteBranding(){
    /* شريط الإعلان */
    const ann = (SITE.announcement || "").trim();
    if(ann){
        const track = document.querySelector(".announcement-track");
        if(track){
            const parts = ann.split(/\s*[·|]\s*/).map(s=>s.trim()).filter(Boolean);
            const items = parts.length ? parts : [ann];
            const loop = items.concat(items); // تكرار للحركة السلسة
            track.innerHTML = loop.map(t=>`<span>${t.replace(/</g,"&lt;")}</span>`).join("");
        }
    }

    /* البانر الرئيسي */
    const badge = document.getElementById("heroBadge");
    const title = document.getElementById("heroTitle");
    const text  = document.getElementById("heroText");
    const btn   = document.getElementById("heroBtn");
    const hero  = document.getElementById("home");
    if(badge && SITE.hero_badge) badge.textContent = SITE.hero_badge;
    if(title && SITE.hero_title) title.textContent = SITE.hero_title;
    if(text  && SITE.hero_text)  text.textContent  = SITE.hero_text;
    if(btn   && SITE.hero_btn)   btn.textContent   = SITE.hero_btn;
    if(hero){
        if(SITE.hero_image && String(SITE.hero_image).startsWith("http")){
            hero.style.backgroundImage = `linear-gradient(120deg, rgba(47,32,21,.72), rgba(94,70,51,.55)), url("${SITE.hero_image}")`;
            hero.style.backgroundSize = "cover";
            hero.style.backgroundPosition = "center";
            hero.classList.add("hero-has-image");
        } else {
            hero.style.backgroundImage = "";
            hero.classList.remove("hero-has-image");
        }
    }
}

async function loadSiteSettings(){
    try{
        const { data } = await supabaseClient.from("site_settings").select("*");
        (data||[]).forEach(r=>{ SITE[r.key] = r.value; });
        SITE.free_shipping_min = Number(SITE.free_shipping_min) || 500;
        if(SITE.wallet_number) PAYMENT_INFO.wallet.number = SITE.wallet_number;
        if(SITE.instapay_handle) PAYMENT_INFO.instapay.handle = SITE.instapay_handle;
        applySiteBranding();
        updateFreeShippingBar();
    } catch(e){ console.warn("settings", e); }
}

function calcDiscount(subtotal, coupon){
    if(!coupon) return 0;
    let d = coupon.discount_type === "percent"
        ? subtotal * (Number(coupon.discount_value)||0) / 100
        : Number(coupon.discount_value)||0;
    return Math.min(Math.max(0, d), subtotal);
}

async function applyCouponCode(){
    const input = document.getElementById("checkoutCoupon");
    const fb = document.getElementById("couponFeedback");
    const code = (input?.value || "").trim();
    if(!code){ fb.textContent = ""; appliedCoupon = null; updateCheckoutDiscountUI(); return; }
    fb.className = "coupon-feedback";
    fb.textContent = "جاري التحقق...";
    const btn = document.getElementById("applyCouponBtn");
    if(btn){ btn.classList.add("is-loading"); btn.textContent = "..."; }
    const phoneForCoupon = (document.getElementById("checkoutPhone")?.value || "").trim();
    const { data, error } = await supabaseClient.rpc("validate_coupon", { p_code: code, p_phone: phoneForCoupon || null });
    if(btn){ btn.classList.remove("is-loading"); btn.textContent = "تطبيق"; }
    if(error || !data?.ok){
        appliedCoupon = null;
        fb.className = "coupon-feedback is-err";
        fb.textContent = data?.error || error?.message || "كود غير صالح";
        updateCheckoutDiscountUI();
        return;
    }
    const sub = cartTotal();
    const amount = calcDiscount(sub, data);
    appliedCoupon = { ...data, discount_amount: amount };
    fb.className = "coupon-feedback is-ok";
    fb.textContent = amount > 0 ? `تم تطبيق خصم ${Math.round(amount)} ج.م بنجاح` : "الكود صالح";
    updateCheckoutDiscountUI();
}

function updateCheckoutDiscountUI(){
    const row = document.getElementById("checkoutDiscountRow");
    const val = document.getElementById("checkoutDiscountVal");
    if(!row || !val) return;
    if(appliedCoupon && appliedCoupon.discount_amount > 0){
        row.classList.remove("hidden");
        val.textContent = `− ${Math.round(appliedCoupon.discount_amount)} ج.م`;
    } else {
        row.classList.add("hidden");
    }
}

function updateFreeShippingBar(){
    const min = SITE.free_shipping_min || 500;
    const total = cartTotal();
    let bar = document.getElementById("freeShipBar");
    if(!bar){
        const footer = document.getElementById("cartFooter");
        if(!footer) return;
        bar = document.createElement("div");
        bar.id = "freeShipBar";
        bar.style.cssText = "font-size:13px;font-weight:700;color:#7a5a3d;background:#f3e9dd;border-radius:12px;padding:10px 12px;margin-bottom:12px;text-align:center;line-height:1.5";
        footer.insertBefore(bar, footer.firstChild);
    }
    if(total <= 0){ bar.style.display = "none"; return; }
    bar.style.display = "block";
    if(total >= min){
        bar.innerHTML = "🎉 طلبك مؤهل للشحن المجاني";
    } else {
        const left = Math.ceil(min - total);
        const pct = Math.min(100, Math.round(total / min * 100));
        bar.innerHTML = `باقي <strong>${left} ج.م</strong> للشحن المجاني<br><span style="display:block;height:6px;background:#e0d0bd;border-radius:6px;margin-top:8px;overflow:hidden"><span style="display:block;height:100%;width:${pct}%;background:linear-gradient(135deg,#8f6a45,#b28a66)"></span></span>`;
    }
}

async function notifyTelegram(orderNumber, name, phone, total, items){
    const token = SITE.telegram_bot_token;
    const chat = SITE.telegram_chat_id;
    if(!token || !chat) return;
    const lines = (items||[]).map(i=>`• ${i.name} × ${i.qty}`).join("\n");
    const msg = `🛍️ طلب جديد #${orderNumber}\n👤 ${name}\n📱 ${phone}\n💰 ${total} ج.م\n${lines}`;
    try{
        await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ chat_id: chat, text: msg })
        });
    } catch(e){ console.warn("telegram", e); }
}


/* ===================== TRANSLATIONS ===================== */
const translations = {
    ar:{buyNow:"شراء الآن",addToCart:"أضف للسلة",addedToCart:"تمت الإضافة للسلة 🛒",currency:"جنيه",langToggle:"EN",dir:"rtl",htmlLang:"ar",
        bestseller:"الأكثر مبيعاً",newBadge:"جديد",comingSoon:"قريباً",comingSoonSub:"منتج جديد سيُضاف قريباً",
        ratingSaved:"تم حفظ تقييمك!",ratingThanks:"شكراً لتقييمك ⭐",
        cartCleared:"تم إفراغ السلة",removed:"تم حذف المنتج",cartEmptyAlert:"سلتك فارغة!",remove:"حذف"},
    en:{buyNow:"Buy Now",addToCart:"Add to Cart",addedToCart:"Added to cart 🛒",currency:"EGP",langToggle:"AR",dir:"ltr",htmlLang:"en",
        bestseller:"Best Seller",newBadge:"New",comingSoon:"Coming Soon",comingSoonSub:"A new product will be added soon",
        ratingSaved:"Your rating has been saved!",ratingThanks:"Thank you for your rating ⭐",
        cartCleared:"Cart cleared",removed:"Item removed",cartEmptyAlert:"Your cart is empty!",remove:"Remove"}
};

/* ===================== بيانات المنتجات (من Supabase) ===================== */
/* دي بتتملى ديناميكيًا من قاعدة البيانات عند تحميل الصفحة، بدل ما تكون ثابتة في الكود */
let productNamesEn   = {};
let bestsellerIds    = new Set();
let newIds           = new Set();
let products          = [];
let comingSoonIds     = [];
let prices             = {};
let productsById       = {};

async function loadProductsFromDB(){
    try{
        const { data, error } = await supabaseClient
            .from("products")
            .select("*")
            .order("id", { ascending: true });
        if(error) throw error;

        productNamesEn = {};
        bestsellerIds  = new Set();
        newIds         = new Set();
        products        = [];
        comingSoonIds   = [];
        prices          = {};
        productsById    = {};

        (data || []).forEach(row=>{
            productsById[row.id] = row;
            if(row.is_active === false) return; /* مخفي من الأدمن */
            if(row.is_coming_soon){
                comingSoonIds.push(row.id);
                return;
            }
            products.push({ id: row.id, name: row.name_ar, category: row.category });
            productNamesEn[row.id] = row.name_en || row.name_ar;
            prices[row.id] = [ Number(row.price) || 0, Number(row.discount_price) || 0 ];
            if(row.is_bestseller) bestsellerIds.add(row.id);
            if(row.is_new)        newIds.add(row.id);
        });
    } catch(err){
        console.error("فشل تحميل المنتجات من قاعدة البيانات:", err);
        productGrid.innerHTML = `<p class="empty-state" style="grid-column:1/-1">
            ${currentLang==='ar' ? 'حصل خطأ في تحميل المنتجات، حاول تحدّث الصفحة 🙏' : 'Error loading products, please refresh the page 🙏'}
        </p>`;
    }
}

/* ===================== HELPERS ===================== */
function getImages(i){
    const row = productsById[i];
    if(row && Array.isArray(row.images) && row.images.length){
        return row.images;
    }
    /* منتجات قديمة اتنقلت من غير روابط صور محفوظة: نحاول التخمين من مجلد image/ المحلي */
    return[
        `image/image${i}.jpg`,
        `image/image${i}.jpeg`,
        `image/image ${i}.jpg`,
        `image/image ${i}.jpeg`
    ];
}

/* بناء وسم الصورة مع سلسلة بدائل ديناميكية (بتشتغل مع أي عدد صور) تنتهي بصورة احتياطية أنيقة */
function imageMarkup(id, altText){
    const im = getImages(id);
    const alt = (altText || "").replace(/"/g, "&quot;");
    const list = (im && im.length ? im : ["image-placeholder.png"]).map(s=>String(s).replace(/'/g,"\\'"));
    let chain = `this.onerror=null;this.classList.add('img-fallback');this.src='image-placeholder.png';`;
    for(let k=list.length-1;k>=1;k--){
        chain = `this.src='${list[k]}';this.onerror=function(){${chain}};`;
    }
    return `<img src="${list[0]}" alt="${alt}" class="product-image" loading="lazy" decoding="async" onerror="${chain}">`;
}

/* هل الصورة موجودة؟ نتحقق بـ Image object */
function imageExists(src){
    return new Promise(resolve=>{
        const img=new Image();
        img.onload=()=>resolve(true);
        img.onerror=()=>resolve(false);
        img.src=src;
    });
}

function saveFavorites(){localStorage.setItem("favorites",JSON.stringify(favorites));}
function saveRatings(){localStorage.setItem("productRatings",JSON.stringify(productRatings));}
function saveCart(){localStorage.setItem("cart",JSON.stringify(cart));}
function t(key){return translations[currentLang][key];}

/* كائن المنتج (مع بديل آمن للبطاقات المُحوّلة 90+) */
function getProductObj(id){
    return products.find(p=>p.id===id) || {id, name:`منتج ${id}`, category:"ديكور"};
}
function nameOf(id){
    const p = getProductObj(id);
    return currentLang==="en" ? (productNamesEn[id] || `Product ${id}`) : p.name;
}
function productName(p){return nameOf(p.id);}

/* ===================== RATING SYSTEM (تقييمات حقيقية من قاعدة البيانات) ===================== */
let allReviews = [];
let reviewsByProduct = {}; // { productId: { rating, count } }

async function loadReviewsFromDB(){
    try{
        const { data, error } = await supabaseClient
            .from("product_reviews")
            .select("*")
            .order("created_at", { ascending: false });
        if(error) throw error;
        allReviews = data || [];
        reviewsByProduct = {};
        allReviews.forEach(r=>{
            const pid = r.product_id;
            if(!reviewsByProduct[pid]) reviewsByProduct[pid] = { sum: 0, count: 0 };
            reviewsByProduct[pid].sum += Number(r.rating) || 0;
            reviewsByProduct[pid].count += 1;
        });
        Object.keys(reviewsByProduct).forEach(pid=>{
            const o = reviewsByProduct[pid];
            o.rating = o.count ? Math.round((o.sum / o.count) * 10) / 10 : 0;
        });
        renderReviewsSection();
    } catch(err){
        console.warn("loadReviewsFromDB:", err.message);
        allReviews = [];
        renderReviewsSection();
    }
}

function getProductRating(id){
    const o = reviewsByProduct[id];
    if(o && o.count) return { rating: o.rating, count: o.count };
    return { rating: 0, count: 0 };
}

function buildRatingHTML(id){
    const data = getProductRating(id);
    let starsHTML = "";
    for(let i=1;i<=5;i++){
        const filled = data.count && i <= Math.round(data.rating) ? "filled" : "";
        starsHTML += `<span class="star ${filled}" data-star="${i}" data-id="${id}" role="button" aria-label="${i} stars">★</span>`;
    }
    const valueText = data.count ? data.rating.toFixed(1) : "0.0";
    const countText = data.count ? `${data.count} تقييم` : `0 تقييم`;
    return `
    <div class="product-rating" data-rating-id="${id}">
        <span class="rating-value">${valueText}</span>
        <span class="rating-stars">${starsHTML}</span>
        <span class="rating-count">${countText}</span>
    </div>`;
}

async function rateProductStars(productId, rating){
    productId = Number(productId);
    rating = Number(rating);
    if(!productId || rating < 1 || rating > 5) return;

    const guestKey = "star_rated_" + productId;
    if(!currentUser && localStorage.getItem(guestKey)){
        showToast("قيّمتِ المنتج ده قبل كده من الجهاز ده");
        return;
    }

    const name = currentUser
        ? (currentProfile?.full_name || currentUser.user_metadata?.full_name || "عميلة")
        : "زائر";

    try{
        if(currentUser){
            const existing = allReviews.find(r =>
                r.user_id === currentUser.id && String(r.product_id) === String(productId)
            );
            if(existing){
                const { error } = await supabaseClient.from("product_reviews")
                    .update({ rating, customer_name: name })
                    .eq("id", existing.id);
                if(error) throw error;
                showToast("تم تحديث تقييمك ⭐");
            } else {
                const { error } = await supabaseClient.from("product_reviews").insert({
                    product_id: productId,
                    user_id: currentUser.id,
                    rating,
                    comment: "",
                    customer_name: name
                });
                if(error) throw error;
                showToast("شكرًا لتقييمك ⭐");
            }
        } else {
            const { error } = await supabaseClient.from("product_reviews").insert({
                product_id: productId,
                user_id: null,
                rating,
                comment: "",
                customer_name: name
            });
            if(error) throw error;
            localStorage.setItem(guestKey, String(rating));
            showToast("شكرًا لتقييمك ⭐");
        }
        await loadReviewsFromDB();
        document.querySelectorAll(`.product-rating[data-rating-id="${productId}"]`).forEach(el=>{
            el.outerHTML = buildRatingHTML(productId);
        });
        attachRatingEventsToAll();
        const modalBody = document.getElementById("productModalBody");
        if(modalBody) attachRatingEvents(modalBody);
    } catch(err){
        console.error(err);
        showToast("فشل حفظ التقييم: " + (err.message || ""));
    }
}

function renderReviewsSection(){
    const grid = document.getElementById("reviewsGrid");
    if(!grid) return;
    if(!allReviews.length){
        grid.innerHTML = `<p class="reviews-empty">لسه مفيش تقييمات. بعد ما تستلمي طلبك تقدري تسيبي رأيك من صفحة طلباتي ⭐</p>`;
        return;
    }
    grid.innerHTML = allReviews.slice(0, 24).map(r=>{
        const stars = "⭐".repeat(Math.min(5, Math.max(1, Number(r.rating)||5)));
        const name = (r.customer_name || "عميلة").trim();
        const initial = name.charAt(0) || "ع";
        const productName = (productsById[r.product_id] && productsById[r.product_id].name_ar) || ("منتج #" + r.product_id);
        const comment = (r.comment || "").trim() || "تقييم بدون تعليق";
        return `
        <div class="review-card">
            <div class="review-stars">${stars}</div>
            <p class="review-text">"${comment.replace(/</g,"&lt;")}"</p>
            <div class="review-author">
                <div class="review-avatar">${initial}</div>
                <div>
                    <strong>${name.replace(/</g,"&lt;")}</strong>
                    <span>${productName.replace(/</g,"&lt;")}</span>
                </div>
            </div>
        </div>`;
    }).join("");
}

function attachRatingEvents(card){
    if(!card) return;
    const ratingContainer = card.querySelector(".product-rating");
    if(!ratingContainer) return;
    const stars = ratingContainer.querySelectorAll(".star");
    const id = Number(ratingContainer.dataset.ratingId);

    stars.forEach(star=>{
        star.style.cursor = "pointer";
        star.addEventListener("click", (e)=>{
            e.preventDefault();
            e.stopPropagation();
            const rating = Number(star.dataset.star);
            rateProductStars(id, rating);
        });
        star.addEventListener("mouseenter", ()=>{
            const hover = Number(star.dataset.star);
            stars.forEach((s, idx)=>{
                s.style.color = idx < hover ? "#f1c40f" : "#ddd";
            });
        });
    });
    ratingContainer.addEventListener("mouseleave", ()=>{
        const data = getProductRating(id);
        stars.forEach((s, idx)=>{
            s.style.color = "";
            s.classList.toggle("filled", data.count > 0 && idx < Math.round(data.rating));
        });
    });
}

function showToast(message){
    const toast = document.getElementById("toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(showToast._tid);
    showToast._tid = setTimeout(() => toast.classList.remove("show"), 2500);
}

/* بناء بلوك السعر (يُظهر السعر القديم فقط لو كان أعلى من الجديد) */
function priceHTML(id){
    const price = prices[id] || [0,0];
    const newP = price[0];
    const oldP = price[1];
    const showOld = oldP && oldP > newP;
    return `
    <div class="price">
        <span class="price-new">${newP ? newP+" "+t("currency") : "—"}</span>
        ${showOld ? `<span class="price-old">${oldP+" "+t("currency")}</span>` : ""}
    </div>`;
}

/* ===================== COMING SOON CARDS ===================== */
function buildComingSoonCard(id, index){
    const delay = ((products.length + index) % 20) * 60;
    const isFav = favorites.some(f=>f.id===id);
    return `
    <div class="product-card coming-soon" data-csid="${id}" style="animation-delay:${delay}ms">
        <div class="fav fav-cs ${isFav?"active":""}" data-csid="${id}">
            ${isFav?"❤":"♡"}
        </div>
        <div class="coming-soon-body">
            <div class="coming-soon-icon">🕐</div>
            <div class="coming-soon-label">${t("comingSoon")}</div>
            <div class="coming-soon-sub">${t("comingSoonSub")}</div>
        </div>
    </div>`;
}

function buildRealCard(id, index, imgSrc){
    const isFav  = favorites.some(f=>f.id===id);
    const name   = nameOf(id);
    const isBest = bestsellerIds.has(id);
    const isNew  = newIds.has(id);
    const badge  = isBest
        ? `<div class="product-badge badge-bestseller">${t("bestseller")}</div>`
        : isNew
        ? `<div class="product-badge badge-new">${t("newBadge")}</div>`
        : "";
    const delay  = ((products.length + index) % 20) * 60;
    const ratingHTML = buildRatingHTML(id);
    const alt = name.replace(/"/g, "&quot;");

    return `
    <div class="product-card" data-id="${id}" style="animation-delay:${delay}ms">
        ${badge}
        <div class="fav ${isFav?"active":""}" aria-label="favorite">
            ${isFav?"❤":"♡"}
        </div>
        <div class="product-image-wrap">
            <img src="${imgSrc}" alt="${alt}" class="product-image" loading="lazy" decoding="async">
        </div>
        <div class="product-content">
            <h3>${name}</h3>
            ${ratingHTML}
            ${priceHTML(id)}
            <div class="qty-row">
                <button class="qty-btn minus" aria-label="decrease">-</button>
                <span class="qty-value">1</span>
                <button class="qty-btn plus" aria-label="increase">+</button>
            </div>
            <button class="buy-btn">${t("addToCart")}</button>
        </div>
    </div>`;
}

/* المنتجات "قريباً" بقت متحكم فيها من لوحة التحكم (is_coming_soon) بدل تخمين وجود الصورة */
function checkComingSoonCards(){ /* غير مستخدمة، متسيبة عشان توافق الاستدعاءات القديمة */ }

/* ===================== FAVORITES ===================== */
function renderFavorites(){
    favoriteGrid.innerHTML="";
    favorites.forEach(p=>{
        const name  = nameOf(p.id);
        const isBest= bestsellerIds.has(p.id);
        const isNew = newIds.has(p.id);
        const badge = isBest
            ? `<div class="product-badge badge-bestseller">${t("bestseller")}</div>`
            : isNew
            ? `<div class="product-badge badge-new">${t("newBadge")}</div>`
            : "";
        const ratingHTML = buildRatingHTML(p.id);

        favoriteGrid.innerHTML+=`
        <div class="product-card" data-id="${p.id}">
            ${badge}
            <div class="fav active" aria-label="favorite">❤</div>
            <div class="product-image-wrap">
                ${imageMarkup(p.id, name)}
            </div>
            <div class="product-content">
                <h3>${name}</h3>
                ${ratingHTML}
                ${priceHTML(p.id)}
                <div class="qty-row">
                    <button class="qty-btn minus" aria-label="decrease">-</button>
                    <span class="qty-value">1</span>
                    <button class="qty-btn plus" aria-label="increase">+</button>
                </div>
                <button class="buy-btn">${t("addToCart")}</button>
            </div>
        </div>`;
    });

    favoriteGrid.querySelectorAll(".product-card").forEach(card=>{
        attachCardEvents(card);
        attachRatingEvents(card);
    });
    if(favoritesEmpty) favoritesEmpty.style.display = favorites.length ? "none" : "block";
    fixSingleCardLayout(favoriteGrid);
}

/* ===================== PRODUCTS ===================== */
function renderProducts(){
    productGrid.innerHTML="";

    /* المنتجات الحقيقية */
    products.forEach((product,index)=>{
        const isFav  = favorites.some(f=>f.id===product.id);
        const name   = nameOf(product.id);
        const isBest = bestsellerIds.has(product.id);
        const isNew  = newIds.has(product.id);
        const badge  = isBest
            ? `<div class="product-badge badge-bestseller">${t("bestseller")}</div>`
            : isNew
            ? `<div class="product-badge badge-new">${t("newBadge")}</div>`
            : "";
        const delay  = (index%20)*60;
        const ratingHTML = buildRatingHTML(product.id);

        productGrid.innerHTML+=`
        <div class="product-card" data-id="${product.id}" style="animation-delay:${delay}ms">
            ${badge}
            <div class="fav ${isFav?"active":""}" aria-label="favorite">
                ${isFav?"❤":"♡"}
            </div>
            <div class="product-image-wrap">
                ${imageMarkup(product.id, name)}
            </div>
            <div class="product-content">
                <h3>${name}</h3>
                ${ratingHTML}
                ${priceHTML(product.id)}
                <div class="qty-row">
                    <button class="qty-btn minus" aria-label="decrease">-</button>
                    <span class="qty-value">1</span>
                    <button class="qty-btn plus" aria-label="increase">+</button>
                </div>
                <button class="buy-btn">${t("addToCart")}</button>
            </div>
        </div>`;
    });

    /* بطاقات "قريباً" 90-124 */
    comingSoonIds.forEach((id,index)=>{
        productGrid.innerHTML += buildComingSoonCard(id, index);
    });

    attachEvents();
    attachRatingEventsToAll();
    attachComingSoonHearts();
    fixSingleCardLayout(productGrid);
    checkComingSoonCards();
}

function attachRatingEventsToAll(){
    document.querySelectorAll("#productGrid .product-card[data-id]").forEach(card=>{
        attachRatingEvents(card);
    });
}

function fixSingleCardLayout(grid){
    const cards=grid.querySelectorAll(".product-card");
    grid.style.gridTemplateColumns=cards.length===1?"repeat(2,1fr)":"";
}

/* ===================== CART ===================== */
function cartQty(){return cart.reduce((s,i)=>s+i.qty,0);}
function cartTotal(){return cart.reduce((s,i)=>{const p=prices[i.id]||[0,0];return s+p[0]*i.qty;},0);}

function updateCartCount(){
    const q = cartQty();
    cartCount.textContent = q;
    cartCount.style.display = q>0 ? "flex" : "none";
    cartBtn.classList.remove("bump");
    void cartBtn.offsetWidth;
    if(q>0) cartBtn.classList.add("bump");
}

function addToCart(id, qty){
    qty = qty || 1;
    const existing = cart.find(i=>i.id===id);
    if(existing) existing.qty += qty;
    else cart.push({id, qty});
    saveCart();
    updateCartCount();
    renderCart();
    showToast(t("addedToCart"));
}

function removeFromCart(id){
    cart = cart.filter(i=>i.id!==id);
    saveCart();
    updateCartCount();
    renderCart();
}

function setCartQty(id, qty){
    const item = cart.find(i=>i.id===id);
    if(!item) return;
    item.qty = Math.max(1, qty);
    saveCart();
    updateCartCount();
    renderCart();
}

function clearCart(){
    cart = [];
    saveCart();
    updateCartCount();
    renderCart();
    showToast(t("cartCleared"));
}

function renderCart(){
    if(!cartItemsEl) return;
    const isEmpty = cart.length===0;
    cartEmptyEl.style.display = isEmpty ? "block" : "none";
    cartFooter.style.display  = isEmpty ? "none" : "block";

    cartItemsEl.innerHTML = "";
    cart.forEach(item=>{
        const name = nameOf(item.id);
        const p = prices[item.id] || [0,0];
        const lineTotal = p[0]*item.qty;
        cartItemsEl.innerHTML += `
        <div class="cart-item" data-id="${item.id}">
            <div class="cart-item-img">${imageMarkup(item.id, name)}</div>
            <div class="cart-item-info">
                <h4>${name}</h4>
                <div class="cart-item-price">${p[0]} ${t("currency")}</div>
                <div class="cart-item-controls">
                    <div class="cart-qty">
                        <button class="cart-qty-btn cart-minus" aria-label="decrease">-</button>
                        <span class="cart-qty-val">${item.qty}</span>
                        <button class="cart-qty-btn cart-plus" aria-label="increase">+</button>
                    </div>
                    <button class="cart-remove" aria-label="${t("remove")}">🗑</button>
                </div>
            </div>
            <div class="cart-item-total">${lineTotal} ${t("currency")}</div>
        </div>`;
    });

    cartTotalEl.textContent = `${cartTotal()} ${t("currency")}`;
    updateFreeShippingBar();

    cartItemsEl.querySelectorAll(".cart-item").forEach(row=>{
        const id = Number(row.dataset.id);
        row.querySelector(".cart-plus").addEventListener("click",()=>setCartQty(id, (cart.find(i=>i.id===id)?.qty||1)+1));
        row.querySelector(".cart-minus").addEventListener("click",()=>setCartQty(id, (cart.find(i=>i.id===id)?.qty||1)-1));
        row.querySelector(".cart-remove").addEventListener("click",()=>removeFromCart(id));
    });
}

function openCart(){
    cartDrawer.classList.add("open");
    cartOverlay.classList.add("show");
    cartDrawer.setAttribute("aria-hidden","false");
    document.body.style.overflow="hidden";
}
function closeCart(){
    cartDrawer.classList.remove("open");
    cartOverlay.classList.remove("show");
    cartDrawer.setAttribute("aria-hidden","true");
    document.body.style.overflow="";
}

/* ===================== نظام الطلبات (يحفظ في Supabase + يفتح واتساب) ===================== */
const checkoutModalOverlay = document.getElementById("checkoutModalOverlay");
const checkoutForm         = document.getElementById("checkoutForm");

function generateOrderNumber(){
    const d = new Date();
    const stamp = String(d.getFullYear()).slice(2) + String(d.getMonth()+1).padStart(2,"0") + String(d.getDate()).padStart(2,"0");
    const rand  = Math.floor(1000 + Math.random()*9000);
    return `HM-${stamp}-${rand}`;
}

function paymentMethodLabel(method){
    if(method==="wallet") return "اتصالات كاش";
    if(method==="instapay") return "إنستاباي";
    return "الدفع عند الاستلام";
}

function sendWhatsAppOrder(orderNumber, name, phone, address, items, total, paymentMethod, discountAmount, couponCode){
    const line = "--------------------";
    const subtotal = (items || []).reduce((s, i) => s + (Number(i.price) || 0) * (Number(i.qty) || 0), 0);
    const disc = Number(discountAmount) || 0;
    const finalTotal = Math.max(0, Number(total) || (subtotal - disc));

    const itemLines = (items || []).map((i, idx) => {
        const rowTotal = (Number(i.price) || 0) * (Number(i.qty) || 0);
        return `${idx + 1}) ${i.name}\n    الكمية: ${i.qty}  |  السعر: ${i.price} ج  |  *${rowTotal} ج*`;
    }).join("\n\n");

    let totalsBlock = `*المجموع الفرعي:* ${subtotal} ج`;
    if (disc > 0) {
        totalsBlock += `\n*الخصم${couponCode ? ` (${couponCode})` : ""}:* −${Math.round(disc * 10) / 10} ج`;
    }
    totalsBlock += `\n*الإجمالي النهائي:* *${Math.round(finalTotal * 10) / 10} ج*`;

    const message = [
        "*Handmade*",
        `طلب جديد  |  ${orderNumber}`,
        line,
        `الاسم: ${name}`,
        `الموبايل: ${phone}`,
        `العنوان: ${address}`,
        `الدفع: ${paymentMethodLabel(paymentMethod)}`,
        line,
        "*المنتجات*",
        itemLines,
        line,
        totalsBlock,
        line,
        "برجاء تأكيد الطلب والتواصل مع العميل.",
        "شكراً لكم"
    ].join("\n");

    const waNum = String(SITE.whatsapp_number || "01288127665").replace(/\D/g, "").replace(/^0/, "20");
    window.open(`https://wa.me/${waNum}?text=${encodeURIComponent(message)}`, "_blank");
}

/* إظهار تعليمات الدفع حسب الطريقة المختارة */
const paymentInstructionsEl = document.getElementById("paymentInstructions");
document.querySelectorAll('input[name="paymentMethod"]').forEach(radio=>{
    radio.addEventListener("change", ()=>{
        document.querySelectorAll(".payment-option").forEach(o=>o.classList.remove("active"));
        radio.closest(".payment-option")?.classList.add("active");
        if(!paymentInstructionsEl) return;
        if(radio.value==="wallet"){
            paymentInstructionsEl.innerHTML = `📱 رقم اتصالات كاش: <strong dir="ltr">${PAYMENT_INFO.wallet.number}</strong><br>${PAYMENT_INFO.wallet.note}`;
            paymentInstructionsEl.classList.remove("hidden");
        } else if(radio.value==="instapay"){
            paymentInstructionsEl.innerHTML = `🏦 إنستاباي: <strong dir="ltr">${PAYMENT_INFO.instapay.handle}</strong><br>${PAYMENT_INFO.instapay.note}`;
            paymentInstructionsEl.classList.remove("hidden");
        } else {
            paymentInstructionsEl.classList.add("hidden");
        }
    });
});

/* إعادة ضبط اختيار طريقة الدفع لوضعها الافتراضي (تُستخدم عند فتح نافذة الطلب أو بعد إرساله بنجاح) */
function resetPaymentUI(){
    const cashRadio = document.querySelector('input[name="paymentMethod"][value="cash"]');
    if(cashRadio) cashRadio.checked = true;
    document.querySelectorAll(".payment-option").forEach(o=>o.classList.remove("active"));
    cashRadio?.closest(".payment-option")?.classList.add("active");
    if(paymentInstructionsEl) paymentInstructionsEl.classList.add("hidden");
}

if(checkoutForm){
    checkoutForm.addEventListener("submit", async (e)=>{
        e.preventDefault();
        if(cart.length===0){showToast(t("cartEmptyAlert"));return;}

        const name    = document.getElementById("checkoutName").value.trim();
        const phone   = document.getElementById("checkoutPhone").value.trim();
        const address = document.getElementById("checkoutAddress").value.trim();
        const notes   = document.getElementById("checkoutNotes").value.trim();
        const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "cash";
        const orderNumber = generateOrderNumber();
        const items = cart.map(i=>{
            const imgs = getImages(i.id) || [];
            const image = imgs.find(u => String(u).startsWith("http")) || imgs[0] || "";
            return {
                id: i.id,
                name: nameOf(i.id),
                qty: i.qty,
                price: (prices[i.id] || [0])[0],
                image
            };
        });
        const subtotal = cartTotal();
        /* إعادة التحقق من الكوبون قبل الحفظ */
        let discountAmount = 0;
        let couponCode = null;
        const couponInput = (document.getElementById("checkoutCoupon")?.value || "").trim();
        if(couponInput){
            const { data: cdata } = await supabaseClient.rpc("validate_coupon", { p_code: couponInput, p_phone: phone || null });
            if(cdata?.ok){
                discountAmount = calcDiscount(subtotal, cdata);
                couponCode = cdata.code;
            }
        }
        const total = Math.max(0, subtotal - discountAmount);

        const submitBtn = checkoutForm.querySelector(".checkout-submit-btn");
        submitBtn.disabled = true;
        submitBtn.textContent = "جاري الإرسال...";

        try{
            const { data: userData } = await supabaseClient.auth.getUser();
            const { error } = await supabaseClient.from("orders").insert({
                order_number: orderNumber,
                customer_name: name,
                customer_phone: phone,
                customer_address: address + (notes ? `\nملاحظات: ${notes}` : ""),
                items: items,
                total: total,
                status: "تم الاستلام",
                payment_method: paymentMethod,
                payment_status: paymentMethod==="cash" ? "غير مطلوب" : "في انتظار التأكيد",
                user_id: userData?.user?.id || null,
                coupon_code: couponCode,
                discount_amount: discountAmount
            });
            if(error) throw error;

            if(couponCode){
                try { await supabaseClient.rpc("redeem_coupon", { p_code: couponCode, p_phone: phone, p_order_number: orderNumber }); } catch(e){ console.warn(e); }
            }
            try {
                await supabaseClient.rpc("decrement_stock", { p_items: items });
            } catch (stockErr) {
                console.warn("تنقيص المخزون فشل:", stockErr);
            }
            notifyTelegram(orderNumber, name, phone, total, items);
        } catch(err){
            console.error("فشل حفظ الطلب:", err);
            showToast("حصل خطأ: " + (err.message || "إرسال الطلب فشل، حاول تاني"));
            submitBtn.disabled = false;
            submitBtn.textContent = "تأكيد الطلب عبر واتساب";
            return;
        }

        sendWhatsAppOrder(orderNumber, name, phone, address, items, total, paymentMethod, discountAmount, couponCode);
        clearCart();
        checkoutModalOverlay.classList.remove("show");
        checkoutForm.reset();
        resetPaymentUI();
        appliedCoupon = null;
        const fb=document.getElementById("couponFeedback"); if(fb) fb.textContent="";
        updateCheckoutDiscountUI();
        submitBtn.disabled = false;
        submitBtn.textContent = "تأكيد الطلب عبر واتساب";
        closeCart();
        loadMyOrders();
        showOrderSuccess(orderNumber, items, total, name);
    });
}

function showOrderSuccess(orderNumber, items, total, customerName){
    const overlay = document.getElementById("orderSuccessOverlay");
    if(!overlay) return;
    const titleEl = document.getElementById("orderSuccessTitle");
    const msgEl = document.getElementById("orderSuccessMsg");
    const numEl = document.getElementById("orderSuccessNumber");
    const sumEl = document.getElementById("orderSuccessSummary");
    if(titleEl) titleEl.textContent = SITE.thankyou_title || "طلبكِ وصلنا بنجاح 🎁";
    if(msgEl) msgEl.textContent = SITE.thankyou_message || "شكرًا لثقتكِ فينا. هنراجع طلبكِ وهنتواصل معاكي قريب.";
    if(numEl) numEl.innerHTML = `رقم الطلب<br><strong>${orderNumber}</strong>`;
    if(sumEl){
        const lines = (items||[]).map(i=>`<div class="os-line"><span>${(i.name||"").replace(/</g,"")} × ${i.qty}</span><span>${(Number(i.price)||0)*(Number(i.qty)||0)} ج</span></div>`).join("");
        sumEl.innerHTML = lines + `<div class="os-total"><span>الإجمالي</span><strong>${total} ج.م</strong></div>`;
    }
    overlay.classList.add("show");
}

document.getElementById("orderSuccessClose")?.addEventListener("click", ()=>{
    document.getElementById("orderSuccessOverlay")?.classList.remove("show");
});
document.getElementById("orderSuccessContinue")?.addEventListener("click", ()=>{
    document.getElementById("orderSuccessOverlay")?.classList.remove("show");
    document.getElementById("products")?.scrollIntoView({ behavior: "smooth" });
});
document.getElementById("orderSuccessOrders")?.addEventListener("click", ()=>{
    document.getElementById("orderSuccessOverlay")?.classList.remove("show");
});

document.getElementById("checkoutModalClose")?.addEventListener("click", ()=>{
    checkoutModalOverlay.classList.remove("show");
});
checkoutModalOverlay?.addEventListener("click", e=>{
    if(e.target === checkoutModalOverlay) checkoutModalOverlay.classList.remove("show");
});

cartBtn.addEventListener("click", openCart);
cartClose.addEventListener("click", closeCart);
cartOverlay.addEventListener("click", closeCart);
cartCheckout.addEventListener("click", async ()=>{
    if(cart.length===0){showToast(t("cartEmptyAlert"));return;}
    if(currentUser){
        const nameEl = document.getElementById("checkoutName");
        const phoneEl = document.getElementById("checkoutPhone");
        if(nameEl && !nameEl.value) nameEl.value = currentProfile?.full_name || "";
        if(phoneEl && !phoneEl.value) phoneEl.value = currentProfile?.phone || "";
    }
    closeCart();
    resetPaymentUI();
    checkoutModalOverlay.classList.add("show");
});
cartClear.addEventListener("click", clearCart);
document.addEventListener("keydown", e=>{
    if(e.key==="Escape"){
        closeCart();
        checkoutModalOverlay?.classList.remove("show");
        document.getElementById("productModalOverlay")?.classList.remove("show");
    }
});

/* ===================== نافذة تفاصيل المنتج ===================== */
const productModalOverlay = document.getElementById("productModalOverlay");
const productModalBody    = document.getElementById("productModalBody");

function openProductModal(id){
    const row = productsById[id];
    if(!row) return;

    /* عدّاد المشاهدات (best effort، من غير ما يعطّل الواجهة لو فشل) — عن طريق دالة آمنة بدل تعديل مباشر */
    supabaseClient.rpc("increment_product_views", { p_id: id }).then(()=>{});
    row.views = (row.views || 0) + 1;

    const name = nameOf(id);
    const desc = currentLang==="ar" ? (row.description_ar || "") : (row.description_en || row.description_ar || "");
    const imgs = getImages(id);
    const ratingHTML = buildRatingHTML(id);
    const similar = products.filter(p=>p.category===row.category && p.id!==id).slice(0,4);

    let galleryHTML = `<div class="modal-gallery-main"><img id="modalGalleryMain" src="${imgs[0]}" alt="${name.replace(/"/g,"&quot;")}"></div>`;
    if(imgs.length > 1){
        galleryHTML += `<div class="modal-gallery-thumbs">` +
            imgs.map((src,i)=>`<img src="${src}" class="modal-thumb ${i===0?"active":""}" data-src="${src}">`).join("") +
            `</div>`;
    }

    let similarHTML = "";
    if(similar.length){
        similarHTML = `<div class="modal-similar"><h4>${currentLang==="ar"?"منتجات مشابهة":"Similar Products"}</h4><div class="modal-similar-grid">` +
            similar.map(p=>`<div class="modal-similar-item" data-id="${p.id}"><img src="${getImages(p.id)[0]}" alt="" loading="lazy"><span>${nameOf(p.id)}</span></div>`).join("") +
            `</div></div>`;
    }

    const cat = row.category || "";
    productModalBody.innerHTML = `
        <div class="modal-gallery">${galleryHTML}</div>
        <div class="modal-info">
            ${cat ? `<span class="modal-cat-pill">${cat}</span>` : ""}
            <h2>${name}</h2>
            ${ratingHTML}
            ${priceHTML(id)}
            <p class="modal-desc">${desc || "قطعة هاند ميد مصنوعة بعناية — كل تفصيلة متعملة بإيد، عشان بيتك يكون أجمل."}</p>
            <div class="modal-handmade-note">✨ شغل يدوي · تشطيب أنيق · جاهز يهدي بيتك</div>
            <div class="modal-actions">
                <button class="btn-primary modal-add-btn">${t("addToCart")}</button>
                <button class="modal-share-btn" aria-label="share">🔗 مشاركة</button>
            </div>
            ${similarHTML}
        </div>`;

    attachRatingEvents(productModalBody);
    productModalBody.querySelectorAll(".modal-thumb").forEach(th=>{
        th.addEventListener("click", ()=>{
            document.getElementById("modalGalleryMain").src = th.dataset.src;
            productModalBody.querySelectorAll(".modal-thumb").forEach(t=>t.classList.remove("active"));
            th.classList.add("active");
        });
    });
    productModalBody.querySelector(".modal-add-btn")?.addEventListener("click", ()=>addToCart(id, 1));
    productModalBody.querySelector(".modal-share-btn")?.addEventListener("click", ()=>shareProduct(id, name));
    productModalBody.querySelectorAll(".modal-similar-item").forEach(el=>{
        el.addEventListener("click", ()=>openProductModal(Number(el.dataset.id)));
    });

    productModalOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
}

function closeProductModal(){
    productModalOverlay.classList.remove("show");
    document.body.style.overflow = "";
    /* شيل باراميتر المنتج من الرابط لو كان موجود */
    if(location.search.includes("product=")){
        history.replaceState(null, "", location.pathname);
    }
}
document.getElementById("productModalClose")?.addEventListener("click", closeProductModal);
productModalOverlay?.addEventListener("click", e=>{
    if(e.target === productModalOverlay) closeProductModal();
});

function shareProduct(id, name){
    const url = `${location.origin}${location.pathname}?product=${id}`;
    if(navigator.share){
        navigator.share({ title: name, url }).catch(()=>{});
    } else {
        navigator.clipboard.writeText(url).then(()=>{
            showToast(currentLang==="ar" ? "تم نسخ رابط المنتج 🔗" : "Product link copied 🔗");
        });
    }
}

/* ===================== EVENTS ===================== */

/* events لأزرار القلب في بطاقات "قريباً" */
function attachComingSoonHearts(){
    document.querySelectorAll(".fav-cs").forEach(btn=>{
        btn.addEventListener("click",()=>{
            const id = Number(btn.dataset.csid);
            const index = favorites.findIndex(f=>f.id===id);
            if(index>-1){
                favorites.splice(index,1);
                btn.classList.remove("active");
                btn.innerHTML="♡";
            } else {
                favorites.push(getProductObj(id));
                btn.classList.add("active");
                btn.innerHTML="❤";
            }
            saveFavorites();
            renderFavorites();
        });
    });
}

/* events لبطاقة واحدة بعينها */
function attachCardEvents(card){
    const id     = Number(card.dataset.id);
    if(!id) return;
    const titleEl = card.querySelector(".product-content h3");
    if(titleEl) titleEl.addEventListener("click", ()=>openProductModal(id));
    const favBtn = card.querySelector(".fav");
    const plus   = card.querySelector(".plus");
    const minus  = card.querySelector(".minus");
    const qtyVal = card.querySelector(".qty-value");
    const buyBtn = card.querySelector(".buy-btn");
    let qty=1;

    if(plus)  plus.addEventListener("click",()=>{qty++;qtyVal.textContent=qty;});
    if(minus) minus.addEventListener("click",()=>{if(qty>1)qty--;qtyVal.textContent=qty;});

    if(favBtn) favBtn.addEventListener("click",()=>{
        const product = getProductObj(id);
        const index=favorites.findIndex(p=>p.id===id);
        if(index>-1){favorites.splice(index,1);favBtn.classList.remove("active");favBtn.innerHTML="♡";}
        else{favorites.push(product);favBtn.classList.add("active");favBtn.innerHTML="❤";}
        saveFavorites();renderFavorites();fixSingleCardLayout(favoriteGrid);
        /* مزامنة قلب نفس المنتج في الشبكتين */
        document.querySelectorAll(`.product-card[data-id="${id}"] .fav`).forEach(f=>{
            const active = favorites.some(p=>p.id===id);
            f.classList.toggle("active", active);
            f.innerHTML = active ? "❤" : "♡";
        });
    });

    if(buyBtn) buyBtn.addEventListener("click",()=>{
        addToCart(id, qty);
        qty=1; qtyVal.textContent=qty;
    });
}

/* events لكل بطاقات المنتجات الحقيقية دفعة واحدة */
function attachEvents(){
    document.querySelectorAll("#productGrid .product-card[data-id]").forEach(card=>attachCardEvents(card));
}

/* ===================== IMAGE MODAL ===================== */
document.addEventListener("click",e=>{
    if(e.target.classList.contains("product-image") && !e.target.closest(".cart-item")){
        modalImage.src=e.target.src;
        modalImage.alt=e.target.alt||"";
        imageModal.style.display="flex";
    }
});
closeModal.onclick=()=>{imageModal.style.display="none";};
imageModal.onclick=e=>{if(e.target===imageModal)imageModal.style.display="none";};

/* ===================== FILTERING ===================== */
let currentCategory="all", currentSearchText="";

document.querySelectorAll(".category-btn").forEach(btn=>{
    btn.addEventListener("click",()=>{
        document.querySelectorAll(".category-btn").forEach(b=>b.classList.remove("active"));
        btn.classList.add("active");
        currentCategory=btn.dataset.category;
        filterProducts();
    });
});

if(searchInput){
    searchInput.addEventListener("input",()=>{
        currentSearchText=searchInput.value.toLowerCase().trim();
        filterProducts();
    });
}

function filterProducts(){
    document.querySelectorAll("#productGrid .product-card").forEach(card=>{
        if(card.classList.contains("coming-soon")){
            card.style.display = currentCategory==="all" && currentSearchText==="" ? "" : "none";
            return;
        }
        const id=Number(card.dataset.id);
        const product=products.find(p=>p.id===id);
        const arName=product?product.name.toLowerCase():"";
        const enName=(productNamesEn[id]||"").toLowerCase();
        const title=arName+" "+enName;
        const cat=(product && product.category) ? String(product.category) : "";
        let showCat=false;
        if(currentCategory==="all") {
            showCat=true;
        } else if(cat) {
            // فلترة أساسية حسب عمود category من لوحة التحكم
            showCat = cat === currentCategory
                || (currentCategory==="مرايات" && (cat==="مرايات" || cat.includes("مراية")))
                || (currentCategory==="ديكور" && (cat==="ديكور" || cat.includes("ديكور")));
        } else {
            // احتياطي للمنتجات القديمة بدون category
            if(currentCategory==="مفارش") showCat=arName.includes("مفرش")||arName.includes("مفارش");
            else if(currentCategory==="مرايات") showCat=arName.includes("مراية")||arName.includes("مرايات");
            else if(currentCategory==="مكرمية") showCat=arName.includes("مكرمية");
            else if(currentCategory==="خيش") showCat=arName.includes("خيش")&&!arName.includes("مراية")&&!arName.includes("مرايات")&&!arName.includes("مفرش")&&!arName.includes("مفارش");
            else if(currentCategory==="ديكور") showCat=arName.includes("ديكور");
        }
        let showSearch=currentSearchText===""||title.includes(currentSearchText);
        card.style.display=(showCat&&showSearch)?"":"none";
    });
    fixSingleCardLayout(productGrid);
}

/* ===================== LANGUAGE ===================== */
function applyLanguage(lang){
    currentLang=lang;
    localStorage.setItem("lang",lang);
    const isAr=lang==="ar";
    document.documentElement.lang=translations[lang].htmlLang;
    document.documentElement.dir=translations[lang].dir;
    document.body.style.direction=translations[lang].dir;
    document.querySelectorAll("[data-ar]").forEach(el=>{
        const tag=el.tagName;
        if(["A","SPAN","H2","H3","H1","P","BUTTON","DIV"].includes(tag)){
            el.textContent=isAr?el.dataset.ar:el.dataset.en;
        }
    });
    /* aria-label للسلة */
    if(cartBtn) cartBtn.setAttribute("aria-label", isAr?cartBtn.dataset.arLabel:cartBtn.dataset.enLabel);
    if(searchInput) searchInput.placeholder=isAr?searchInput.dataset.arPlaceholder:searchInput.dataset.enPlaceholder;
    renderProducts();
    renderFavorites();
    renderCart();
    filterProducts();
}

/* ===================== HAMBURGER ===================== */
hamburger.addEventListener("click",()=>{
    const open = hamburger.classList.toggle("open");
    mainNav.classList.toggle("open");
    hamburger.setAttribute("aria-expanded", open ? "true" : "false");
});

mainNav.querySelectorAll("a").forEach(a=>{
    a.addEventListener("click",()=>{
        hamburger.classList.remove("open");
        mainNav.classList.remove("open");
        hamburger.setAttribute("aria-expanded","false");
    });
});

/* ===================== BACK TO TOP ===================== */
window.addEventListener("scroll",()=>{
    backToTop.classList.toggle("visible",window.scrollY>400);
});
backToTop.addEventListener("click",()=>window.scrollTo({top:0,behavior:"smooth"}));

/* ===================== COUNTDOWN ===================== */
(function(){
    const SEVEN_DAYS=7*24*60*60*1000;
    let endTime;
    const stored=localStorage.getItem("cdEnd");
    if(stored){
        endTime=parseInt(stored);
        if(endTime<Date.now()){endTime=Date.now()+SEVEN_DAYS;localStorage.setItem("cdEnd",endTime);}
    } else {
        endTime=Date.now()+SEVEN_DAYS;
        localStorage.setItem("cdEnd",endTime);
    }
    function updateCD(){
        const diff=endTime-Date.now();
        if(diff<=0){endTime=Date.now()+SEVEN_DAYS;localStorage.setItem("cdEnd",endTime);return;}
        const tot=Math.floor(diff/1000);
        const h=Math.floor(tot/3600);
        const m=Math.floor((tot%3600)/60);
        const s=tot%60;
        document.getElementById("cdHours").textContent=String(h).padStart(2,"0");
        document.getElementById("cdMins").textContent=String(m).padStart(2,"0");
        document.getElementById("cdSecs").textContent=String(s).padStart(2,"0");
    }
    updateCD();
    setInterval(updateCD,1000);
})();

/* ===================== INIT ===================== */
async function initApp(){
    await loadSiteSettings();
    await loadProductsFromDB();
    await loadReviewsFromDB();
    applyLanguage(currentLang);
    document.getElementById("applyCouponBtn")?.addEventListener("click", applyCouponCode);
    document.getElementById("checkoutCoupon")?.addEventListener("keydown", e=>{ if(e.key==="Enter"){ e.preventDefault(); applyCouponCode(); }});

    updateCartCount();
    renderCart();

    /* لو حد فتح رابط منتج متشارك (?product=ID) نفتحله تفاصيل المنتج تلقائيًا */
    const sharedId = Number(new URLSearchParams(location.search).get("product"));
    if(sharedId && productsById[sharedId]){
        setTimeout(()=>openProductModal(sharedId), 300);
    }
}
initApp();
/* ===================== نظام الحسابات (تسجيل دخول / حساب جديد) ===================== */
let currentUser    = null;
let currentProfile = null;

const accountBtn        = document.getElementById("accountBtn");
const accountLabel      = document.getElementById("accountLabel");
const authModalOverlay  = document.getElementById("authModalOverlay");
const authModalClose    = document.getElementById("authModalClose");
const ordersLoggedOutEl = document.getElementById("ordersLoggedOut");
const ordersListEl      = document.getElementById("ordersList");
const ordersEmptyEl     = document.getElementById("ordersEmpty");
const ordersLoginBtn    = document.getElementById("ordersLoginBtn");

/* بنحوّل رقم الموبايل لصيغة إيميل وهمية عشان نستخدم نظام Supabase Auth
   من غير ما نحتاج نشترك في خدمة إرسال SMS مدفوعة */
function phoneToPseudoEmail(phone){
    const digits = phone.replace(/\D/g, "");
    return `p${digits}@handmade.local`;
}

function openAuthModal(){
    authModalOverlay.classList.add("show");
    document.body.style.overflow = "hidden";
}
function closeAuthModal(){
    authModalOverlay.classList.remove("show");
    document.body.style.overflow = "";
    document.getElementById("loginError").textContent = "";
    document.getElementById("signupError").textContent = "";
}
authModalClose?.addEventListener("click", closeAuthModal);
authModalOverlay?.addEventListener("click", e=>{ if(e.target===authModalOverlay) closeAuthModal(); });

/* تبديل تاب دخول / حساب جديد */
document.querySelectorAll(".auth-tab").forEach(tab=>{
    tab.addEventListener("click", ()=>{
        document.querySelectorAll(".auth-tab").forEach(x=>x.classList.remove("active"));
        document.querySelectorAll(".auth-panel").forEach(x=>x.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById(tab.dataset.authtab==="login" ? "authPanelLogin" : "authPanelSignup").classList.add("active");
    });
});

/* تبديل موبايل / إيميل داخل كل تاب */
document.querySelectorAll(".auth-panel").forEach(panel=>{
    panel.querySelectorAll(".auth-method-btn").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            panel.querySelectorAll(".auth-method-btn").forEach(b=>b.classList.remove("active"));
            btn.classList.add("active");
            panel.querySelectorAll(".auth-form").forEach(f=>f.classList.add("hidden"));
            const prefix = panel.id === "authPanelLogin" ? "loginForm" : "signupForm";
            document.getElementById(prefix + (btn.dataset.method==="phone" ? "Phone" : "Email")).classList.remove("hidden");
        });
    });
});

/* ===== تسجيل دخول بالموبايل ===== */
document.getElementById("loginFormPhone").addEventListener("submit", async e=>{
    e.preventDefault();
    const phone = document.getElementById("loginPhone").value.trim();
    const pass  = document.getElementById("loginPhonePass").value;
    const errEl = document.getElementById("loginError");
    errEl.textContent = "";
    const { error } = await supabaseClient.auth.signInWithPassword({ email: phoneToPseudoEmail(phone), password: pass });
    if(error){ errEl.textContent = "رقم الموبايل أو كلمة المرور غلط"; return; }
    closeAuthModal();
    showToast("تم تسجيل الدخول ✅");
});

/* ===== تسجيل دخول بالإيميل ===== */
document.getElementById("loginFormEmail").addEventListener("submit", async e=>{
    e.preventDefault();
    const email = document.getElementById("loginEmail").value.trim();
    const pass  = document.getElementById("loginEmailPass").value;
    const errEl = document.getElementById("loginError");
    errEl.textContent = "";
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password: pass });
    if(error){ errEl.textContent = "الإيميل أو كلمة المرور غلط"; return; }
    closeAuthModal();
    showToast("تم تسجيل الدخول ✅");
});

/* ===== حساب جديد بالموبايل ===== */
document.getElementById("signupFormPhone").addEventListener("submit", async e=>{
    e.preventDefault();
    const name  = document.getElementById("signupNamePhone").value.trim();
    const phone = document.getElementById("signupPhone").value.trim();
    const pass  = document.getElementById("signupPhonePass").value;
    const errEl = document.getElementById("signupError");
    errEl.textContent = "";
    const { data, error } = await supabaseClient.auth.signUp({
        email: phoneToPseudoEmail(phone),
        password: pass,
        options: { data: { full_name: name, phone: phone } }
    });
    if(error){
        errEl.textContent = error.message.includes("already") ? "الرقم ده مسجل قبل كده" : "حصل خطأ: " + error.message;
        return;
    }
    if(!data.session){
        /* الحساب اتعمل في القاعدة، بس مفيش تسجيل دخول فوري - غالبًا "Confirm email" لسه مفعّلة في إعدادات Supabase */
        errEl.style.color = "#238552";
        errEl.textContent = "تم إنشاء الحساب، بس محتاجين نقفل خاصية تأكيد الإيميل من إعدادات Supabase عشان الدخول يبقى فوري (كلمي المطور).";
        return;
    }
    closeAuthModal();
    showToast("تم إنشاء الحساب بنجاح ✅");
});

/* ===== حساب جديد بالإيميل ===== */
document.getElementById("signupFormEmail").addEventListener("submit", async e=>{
    e.preventDefault();
    const name  = document.getElementById("signupNameEmail").value.trim();
    const email = document.getElementById("signupEmail").value.trim();
    const pass  = document.getElementById("signupEmailPass").value;
    const errEl = document.getElementById("signupError");
    errEl.textContent = "";
    const { data, error } = await supabaseClient.auth.signUp({
        email,
        password: pass,
        options: { data: { full_name: name } }
    });
    if(error){
        errEl.textContent = error.message.includes("already") ? "الإيميل ده مسجل قبل كده" : "حصل خطأ: " + error.message;
        return;
    }
    if(!data.session){
        errEl.style.color = "#238552";
        errEl.textContent = "تم إنشاء الحساب، وبعتنالك رابط تأكيد على الإيميل. افتحيه الأول وبعدين سجّلي دخول.";
        return;
    }
    closeAuthModal();
    showToast("تم إنشاء الحساب بنجاح ✅");
});

/* ===== قائمة الحساب (دخول/خروج) ===== */
const accountDropdown = document.createElement("div");
accountDropdown.className = "account-dropdown";
accountDropdown.innerHTML = `
    <button id="ddMyOrders">📦 طلباتي</button>
    <button id="ddLogout">🚪 تسجيل الخروج</button>`;
accountBtn.parentElement.appendChild(accountDropdown);

accountBtn.addEventListener("click", ()=>{
    if(currentUser){
        accountDropdown.classList.toggle("show");
    } else {
        openAuthModal();
    }
});
document.addEventListener("click", e=>{
    if(!accountBtn.contains(e.target) && !accountDropdown.contains(e.target)){
        accountDropdown.classList.remove("show");
    }
});
accountDropdown.querySelector("#ddMyOrders").addEventListener("click", ()=>{
    accountDropdown.classList.remove("show");
    document.getElementById("myorders").scrollIntoView({behavior:"smooth"});
    if(currentUser) loadMyOrders();
});
accountDropdown.querySelector("#ddLogout").addEventListener("click", async ()=>{
    accountDropdown.classList.remove("show");
    await supabaseClient.auth.signOut();
    showToast("تم تسجيل الخروج");
});

ordersLoginBtn?.addEventListener("click", openAuthModal);

document.getElementById("navMyOrders")?.addEventListener("click", ()=>{
    if(currentUser) loadMyOrders();
});

/* تحديث الطلبات أوتوماتيك لما العميل يرجع لتاب الموقع (مثلاً بعد ما يتصفح واتساب أو تطبيق تاني) */
document.addEventListener("visibilitychange", ()=>{
    if(document.visibilityState === "visible" && currentUser) loadMyOrders();
});

/* ===== تحديث الواجهة حسب حالة الدخول ===== */
let ordersRealtimeChannel = null;

/* اشتراك لحظي (Realtime): أي تغيير في حالة طلبات العميل الحالي يوصله فورًا من غير ما يعمل ريفريش يدوي */
function subscribeToMyOrders(){
    if(ordersRealtimeChannel){
        supabaseClient.removeChannel(ordersRealtimeChannel);
        ordersRealtimeChannel = null;
    }
    if(!currentUser) return;
    ordersRealtimeChannel = supabaseClient
        .channel(`orders-user-${currentUser.id}`)
        .on("postgres_changes",
            { event: "*", schema: "public", table: "orders", filter: `user_id=eq.${currentUser.id}` },
            (payload)=>{
                loadMyOrders();
                if(payload.eventType === "UPDATE"){
                    showToast("تم تحديث حالة أحد طلباتك 📦");
                }
            }
        )
        .subscribe();
}

async function refreshAuthUI(){
    const { data } = await supabaseClient.auth.getUser();
    currentUser = data?.user || null;

    if(currentUser){
        const { data: profile } = await supabaseClient.from("profiles").select("*").eq("id", currentUser.id).single();
        currentProfile = profile || null;
        accountLabel.textContent = currentProfile?.full_name?.split(" ")[0] || "حسابي";
        accountBtn.classList.add("logged-in");
        loadMyOrders();
        subscribeToMyOrders();
    } else {
        currentProfile = null;
        accountLabel.textContent = "تسجيل الدخول";
        accountBtn.classList.remove("logged-in");
        ordersLoggedOutEl.classList.remove("hidden");
        ordersListEl.classList.add("hidden");
        ordersEmptyEl.classList.add("hidden");
        subscribeToMyOrders(); /* هيلغي أي اشتراك قديم لأن currentUser بقى null */
    }
}

supabaseClient.auth.onAuthStateChange(()=>refreshAuthUI());

/* ===== تحميل طلبات المستخدم الحالي ===== */
function canCancelOrder(o){
    if(!o || o.status !== "تم الاستلام") return false;
    const created = new Date(o.created_at).getTime();
    return (Date.now() - created) <= 10 * 60 * 1000;
}

async function cancelOrder(orderId){
    if(!confirm("متأكدة إنك عايزة تلغي الطلب؟")) return;
    const { data, error } = await supabaseClient.rpc("cancel_my_order", { p_order_id: Number(orderId) });
    if(error){
        showToast("فشل الإلغاء: " + error.message);
        return;
    }
    if(data && data.ok === false){
        showToast(data.error || "تعذر إلغاء الطلب");
        return;
    }
    showToast("تم إلغاء الطلب ✅");
    loadMyOrders();
}

async function submitProductReview(orderId, productId, rating, comment){
    if(!currentUser){ showToast("سجّلي دخول أولاً"); return; }
    if(!rating || rating < 1){ showToast("اختاري عدد النجوم"); return; }
    if(!productId){ showToast("اختاري منتج"); return; }
    const name = currentProfile?.full_name || currentUser.user_metadata?.full_name || "عميلة";
    const existing = allReviews.find(r =>
        r.user_id === currentUser.id && String(r.product_id) === String(productId)
    );

    let error;
    if(existing){
        ({ error } = await supabaseClient.from("product_reviews").update({
            rating: Number(rating),
            comment: (comment || "").trim(),
            customer_name: name,
            order_id: Number(orderId)
        }).eq("id", existing.id));
    } else {
        ({ error } = await supabaseClient.from("product_reviews").insert({
            product_id: Number(productId),
            user_id: currentUser.id,
            order_id: Number(orderId),
            rating: Number(rating),
            comment: (comment || "").trim(),
            customer_name: name
        }));
    }

    if(error){
        showToast("فشل حفظ التقييم: " + error.message);
        return;
    }
    showToast(existing ? "تم تعديل تقييمك ✅" : "شكرًا لتقييمك ⭐");
    await loadReviewsFromDB();
    loadMyOrders();
}

async function loadMyOrders(){
    if(!currentUser) return;
    const { data, error } = await supabaseClient
        .from("orders")
        .select("*")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false });

    ordersLoggedOutEl.classList.add("hidden");

    if(error || !data || data.length===0){
        ordersListEl.classList.add("hidden");
        ordersEmptyEl.classList.remove("hidden");
        return;
    }

    const myReviewsMap = {};
    allReviews.filter(r => r.user_id === currentUser.id).forEach(r=>{
        myReviewsMap[String(r.product_id)] = r;
    });

    ordersEmptyEl.classList.add("hidden");
    ordersListEl.classList.remove("hidden");
    ordersListEl.innerHTML = data.map(o=>{
        const date = new Date(o.created_at).toLocaleDateString("ar-EG", { day:"numeric", month:"long", year:"numeric" });
        const items = Array.isArray(o.items) ? o.items : [];
        const itemsText = items.map(i=>`${i.name} × ${i.qty}`).join("، ");
        const statusClass = "status-" + (o.status||"").replace(/ /g,"-");
        const showCancel = canCancelOrder(o);
        const reviewableItems = items.filter(i => i.id);
        const showReview = o.status === "تم التسليم" && reviewableItems.length > 0;
        const hasAnyReview = reviewableItems.some(i => myReviewsMap[String(i.id)]);
        const reviewOptions = reviewableItems
            .map(i=>{
                const existing = myReviewsMap[String(i.id)];
                const tag = existing ? " (تعديل)" : "";
                return `<option value="${i.id}">${(i.name||"").replace(/</g,"")}${tag}</option>`;
            })
            .join("");

        return `
        <div class="order-card" data-order-id="${o.id}">
            <div class="order-card-top">
                <strong>طلب #${o.order_number}</strong>
                <span class="order-status-badge ${statusClass}">${o.status}</span>
            </div>
            <div class="order-card-items">${itemsText}</div>
            <div class="order-card-bottom">
                <span class="order-payment-tag">${paymentMethodLabel(o.payment_method)}</span>
                <span>${o.total} جنيه</span>
            </div>
            <div class="order-card-date">🕐 ${date}</div>
            ${showCancel ? `<button type="button" class="order-cancel-btn" data-cancel-id="${o.id}">إلغاء الطلب (خلال 10 دقائق)</button>` : ""}
            ${showReview ? `
            <button type="button" class="order-review-btn" data-toggle-review="${o.id}">${hasAnyReview ? "تعديل / إضافة تقييم ⭐" : "اتركي تقييم ⭐"}</button>
            <div class="review-form-box hidden" id="reviewForm-${o.id}">
                <select id="reviewProduct-${o.id}">${reviewOptions}</select>
                <div class="review-stars-pick" data-order="${o.id}">
                    <span data-v="1">★</span><span data-v="2">★</span><span data-v="3">★</span><span data-v="4">★</span><span data-v="5">★</span>
                </div>
                <textarea id="reviewComment-${o.id}" rows="2" placeholder="تعليقك (اختياري)"></textarea>
                <button type="button" class="review-submit-btn" data-submit-review="${o.id}">حفظ التقييم</button>
            </div>` : ""}
        </div>`;
    }).join("");

    ordersListEl.querySelectorAll("[data-cancel-id]").forEach(btn=>{
        btn.addEventListener("click", ()=>cancelOrder(btn.dataset.cancelId));
    });
    ordersListEl.querySelectorAll("[data-toggle-review]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            const box = document.getElementById("reviewForm-" + btn.dataset.toggleReview);
            if(box) box.classList.toggle("hidden");
        });
    });
    ordersListEl.querySelectorAll(".review-stars-pick").forEach(pick=>{
        pick.dataset.value = "0";
        pick.querySelectorAll("span").forEach(star=>{
            star.addEventListener("click", ()=>{
                const v = Number(star.dataset.v);
                pick.dataset.value = String(v);
                pick.querySelectorAll("span").forEach(s=>{
                    s.classList.toggle("on", Number(s.dataset.v) <= v);
                });
            });
        });
    });
    ordersListEl.querySelectorAll("[data-submit-review]").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            const oid = btn.dataset.submitReview;
            const productId = document.getElementById("reviewProduct-" + oid)?.value;
            const rating = Number(document.querySelector(`.review-stars-pick[data-order="${oid}"]`)?.dataset.value || 0);
            const comment = document.getElementById("reviewComment-" + oid)?.value || "";
            submitProductReview(oid, productId, rating, comment);
        });
    });

    /* عند اختيار منتج: لو عندها تقييم سابق نملأ النجوم والتعليق */
    ordersListEl.querySelectorAll("[id^='reviewProduct-']").forEach(sel=>{
        const oid = sel.id.replace("reviewProduct-", "");
        const fillFromExisting = ()=>{
            const existing = myReviewsMap[String(sel.value)];
            const pick = document.querySelector(`.review-stars-pick[data-order="${oid}"]`);
            const ta = document.getElementById("reviewComment-" + oid);
            if(existing){
                const v = Number(existing.rating) || 0;
                if(pick){
                    pick.dataset.value = String(v);
                    pick.querySelectorAll("span").forEach(s=>s.classList.toggle("on", Number(s.dataset.v) <= v));
                }
                if(ta) ta.value = existing.comment || "";
            } else {
                if(pick){
                    pick.dataset.value = "0";
                    pick.querySelectorAll("span").forEach(s=>s.classList.remove("on"));
                }
                if(ta) ta.value = "";
            }
        };
        sel.addEventListener("change", fillFromExisting);
        fillFromExisting();
    });
}

refreshAuthUI();