/* ===================== إعدادات ===================== */
/* مفيش service_role هنا خالص — بنستخدم الـ anon key بس (آمن للمتصفح) */
const SUPABASE_URL = "https://lfrnqlutoftjtbxjdhhw.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imxmcm5xbHV0b2Z0anRieGpkaGh3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU2MTk5NjUsImV4cCI6MjEwMTE5NTk2NX0.1e2YZF2aZoe_EzlW5f-BQ1AGQ2tKfKcdBnncpcf-HRw";
const supa = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* !! غيّري الباسورد ده لحاجة قوية تخص أمك بس، ومتشاركيهاش مع حد !! */
const ADMIN_PASSWORD = "handmade2026";

const ORDER_STATUSES = ["تم الاستلام", "جاري التنفيذ", "تم الشحن", "تم التسليم", "ملغي"];

let allProducts = [];
let allOrders   = [];
let currentImages = []; // صور المنتج اللي بيتم تعديله/إضافته حاليًا

/* ===================== تسجيل الدخول ===================== */
const loginScreen  = document.getElementById("loginScreen");
const dashboard     = document.getElementById("dashboard");

function checkSession(){
    if(sessionStorage.getItem("adminAuthed") === "1"){
        loginScreen.classList.add("hidden");
        dashboard.classList.remove("hidden");
        initDashboard();
    }
}

document.getElementById("loginBtn").addEventListener("click", doLogin);
document.getElementById("loginPassword").addEventListener("keydown", e=>{ if(e.key==="Enter") doLogin(); });

function doLogin(){
    const val = document.getElementById("loginPassword").value;
    if(val === ADMIN_PASSWORD){
        sessionStorage.setItem("adminAuthed", "1");
        loginScreen.classList.add("hidden");
        dashboard.classList.remove("hidden");
        initDashboard();
    } else {
        document.getElementById("loginError").textContent = "كلمة المرور غلط، حاولي تاني";
    }
}

document.getElementById("logoutBtn").addEventListener("click", ()=>{
    sessionStorage.removeItem("adminAuthed");
    location.reload();
});

checkSession();

/* ===================== تبديل التابات ===================== */
document.querySelectorAll(".nav-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
        document.querySelectorAll(".nav-btn").forEach(b=>b.classList.remove("active"));
        document.querySelectorAll(".tab-panel").forEach(p=>p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
    });
});

function initDashboard(){
    loadProducts();
    loadOrders();
    loadCustomers();
    loadCoupons();
    loadReviews();
    loadSettings();
    loadStats();
}

/* ===================== Toast ===================== */
function showToast(msg){
    const el = document.getElementById("adminToast");
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(showToast._t);
    showToast._t = setTimeout(()=>el.classList.remove("show"), 2600);
}

/* ===================== المنتجات ===================== */
async function loadProducts(){
    const { data, error } = await supa.from("products").select("*").order("id", { ascending: true });
    if(error){ showToast("فشل تحميل المنتجات: " + error.message); return; }
    allProducts = data || [];
    renderProductsTable();
}

function renderProductsTable(){
    const search = document.getElementById("productSearch").value.trim().toLowerCase();
    const tbody = document.getElementById("productsTableBody");
    const filtered = allProducts.filter(p=>{
        if(!search) return true;
        return (p.name_ar||"").toLowerCase().includes(search) || (p.name_en||"").toLowerCase().includes(search) || String(p.id).includes(search);
    });

    document.getElementById("productsCount").textContent = allProducts.length;

    tbody.innerHTML = filtered.map(p=>{
        const thumb = (p.images && p.images[0]) ? p.images[0] : "";
        const statusBadges = [
            p.is_active === false ? `<span class="badge" style="background:#fbe4e1;color:#c0392b">مخفي</span>` : "",
            p.is_coming_soon ? `<span class="badge badge-coming">قريباً</span>` : "",
            p.is_bestseller  ? `<span class="badge badge-bestseller">الأكثر مبيعاً</span>` : "",
            p.is_new         ? `<span class="badge badge-new">جديد</span>` : ""
        ].filter(Boolean).join(" ") || `<span class="badge badge-ok">متاح</span>`;
        const priceDisplay = p.is_coming_soon ? "—" : `${p.price} ج.م` + (p.discount_price ? ` <s style="color:#b6a48d">${p.discount_price}</s>` : "");

        return `
        <tr data-id="${p.id}">
            <td>${thumb ? `<img src="${thumb}" class="table-thumb" onerror="this.style.opacity=0.3">` : `<div class="table-thumb"></div>`}</td>
            <td>#${p.id} — ${p.name_ar}</td>
            <td>${p.category}</td>
            <td>${priceDisplay}</td>
            <td>${statusBadges}</td>
            <td>${p.stock_count ?? 0}</td>
            <td>
                <div class="row-actions">
                    <button class="icon-btn edit-product-btn" data-id="${p.id}" title="تعديل">✏️</button>
                    <button class="icon-btn danger delete-product-btn" data-id="${p.id}" title="حذف">🗑️</button>
                </div>
            </td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".edit-product-btn").forEach(b=>b.addEventListener("click", ()=>openProductForm(b.dataset.id)));
    tbody.querySelectorAll(".delete-product-btn").forEach(b=>b.addEventListener("click", ()=>deleteProduct(b.dataset.id)));
}

document.getElementById("productSearch").addEventListener("input", renderProductsTable);

async function deleteProduct(id){
    if(!confirm("متأكدة إنك عايزة تحذفي المنتج ده؟ الإجراء ده مش هيتراجع.")) return;
    const { error } = await supa.from("products").delete().eq("id", id);
    if(error){ 
        console.error("Delete error:", error);
        showToast("فشل الحذف: " + error.message); 
        return; 
    }
    showToast("تم حذف المنتج ✅");
    loadProducts();
}

/* ===================== فورم المنتج (إضافة/تعديل) ===================== */
const productModalOverlay = document.getElementById("productModalOverlay");
const productForm = document.getElementById("productForm");

document.getElementById("addProductBtn").addEventListener("click", ()=>openProductForm(null));
document.getElementById("productModalClose").addEventListener("click", closeProductForm);
productModalOverlay.addEventListener("click", e=>{ if(e.target === productModalOverlay) closeProductForm(); });

function openProductForm(id){
    productForm.reset();
    currentImages = [];
    document.getElementById("imagePreviewGrid").innerHTML = "";

    if(id){
        const p = allProducts.find(x => String(x.id) === String(id));
        if(!p) return;
        document.getElementById("productModalTitle").textContent = `تعديل: ${p.name_ar}`;
        document.getElementById("pf_id").value = p.id;
        document.getElementById("pf_name_ar").value = p.name_ar || "";
        document.getElementById("pf_category").value = p.category || "ديكور";
        document.getElementById("pf_stock").value = p.stock_count ?? 100;
        document.getElementById("pf_price").value = p.price ?? "";
        document.getElementById("pf_discount_price").value = p.discount_price ?? "";
        document.getElementById("pf_description_ar").value = p.description_ar || "";
        document.getElementById("pf_bestseller").checked = !!p.is_bestseller;
        document.getElementById("pf_new").checked = !!p.is_new;
        document.getElementById("pf_coming_soon").checked = !!p.is_coming_soon;
        const actEl = document.getElementById("pf_active");
        if(actEl) actEl.checked = p.is_active !== false;
        currentImages = Array.isArray(p.images) ? [...p.images] : [];
        renderImagePreviews();
    } else {
        document.getElementById("productModalTitle").textContent = "إضافة منتج جديد";
        document.getElementById("pf_id").value = "";
        const actEl = document.getElementById("pf_active");
        if(actEl) actEl.checked = true;
    }
    productModalOverlay.classList.add("show");
}

function closeProductForm(){
    productModalOverlay.classList.remove("show");
}

function renderImagePreviews(){
    const grid = document.getElementById("imagePreviewGrid");
    grid.innerHTML = currentImages.map((src,idx)=>`
        <div class="image-preview-item">
            <img src="${src}">
            <button type="button" class="remove-img" data-idx="${idx}">×</button>
        </div>`).join("");
    grid.querySelectorAll(".remove-img").forEach(btn=>{
        btn.addEventListener("click", ()=>{
            currentImages.splice(Number(btn.dataset.idx), 1);
            renderImagePreviews();
        });
    });
}

/* ===== رفع الصور بالسحب والإفلات ===== */
const dropzone  = document.getElementById("dropzone");
const fileInput = document.getElementById("fileInput");

dropzone.addEventListener("click", ()=>fileInput.click());
dropzone.addEventListener("dragover", e=>{ e.preventDefault(); dropzone.classList.add("dragover"); });
dropzone.addEventListener("dragleave", ()=>dropzone.classList.remove("dragover"));
dropzone.addEventListener("drop", e=>{
    e.preventDefault();
    dropzone.classList.remove("dragover");
    handleFiles(e.dataTransfer.files);
});
fileInput.addEventListener("change", e=>handleFiles(e.target.files));

/* ضغط الصورة قبل الرفع عشان الموقع يبقى أسرع */
function compressImage(file, maxWidth = 1200, quality = 0.82){
    return new Promise((resolve, reject)=>{
        if(!file.type.startsWith("image/")){ resolve(file); return; }
        const img = new Image();
        const url = URL.createObjectURL(file);
        img.onload = ()=>{
            URL.revokeObjectURL(url);
            let w = img.width, h = img.height;
            if(w > maxWidth){ h = Math.round(h * maxWidth / w); w = maxWidth; }
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const ctx = canvas.getContext("2d");
            ctx.drawImage(img, 0, 0, w, h);
            canvas.toBlob(blob=>{
                if(!blob){ resolve(file); return; }
                const name = (file.name || "photo.jpg").replace(/\.[^.]+$/, ".jpg");
                resolve(new File([blob], name, { type: "image/jpeg" }));
            }, "image/jpeg", quality);
        };
        img.onerror = ()=>{ URL.revokeObjectURL(url); resolve(file); };
        img.src = url;
    });
}

async function handleFiles(fileList){
    const files = Array.from(fileList).filter(f=>f.type.startsWith("image/"));
    for(const file of files){
        const placeholderIdx = currentImages.length;
        currentImages.push(""); // placeholder أثناء الرفع
        renderUploadingState(placeholderIdx);

        try{
            const compressed = await compressImage(file);
            const path = `uploads/${Date.now()}_${Math.random().toString(36).slice(2,8)}.jpg`;
            const { error: upErr } = await supa.storage.from("products").upload(path, compressed, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
            if(upErr) throw upErr;
            const { data: urlData } = supa.storage.from("products").getPublicUrl(path);
            currentImages[placeholderIdx] = urlData.publicUrl;
        } catch(err){
            const msg = (err.message || "").toLowerCase();
            if(msg.includes("bucket not found")){
                showToast('فشل رفع الصورة: لازم تعملي Storage bucket اسمه "products" في Supabase (Storage → New bucket → public)');
            } else {
                showToast("فشل رفع صورة: " + err.message);
            }
            currentImages.splice(placeholderIdx, 1);
        }
        renderImagePreviews();
    }
}

function renderUploadingState(idx){
    const grid = document.getElementById("imagePreviewGrid");
    const div = document.createElement("div");
    div.className = "image-preview-item uploading";
    div.dataset.idx = idx;
    div.innerHTML = `<img src="">`;
    grid.appendChild(div);
}

/* ===== حفظ المنتج ===== */
productForm.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const submitBtn = document.getElementById("productFormSubmit");
    submitBtn.disabled = true;
    submitBtn.textContent = "جاري الحفظ...";

    try {
        const id = document.getElementById("pf_id").value;
        // حقول الاسم/الوصف بالإنجليزي اختيارية — لو مش موجودة في الـ HTML مش هنفشل
        const nameEnEl = document.getElementById("pf_name_en");
        const descEnEl = document.getElementById("pf_description_en");

        const payload = {
            name_ar: document.getElementById("pf_name_ar").value.trim(),
            name_en: nameEnEl ? (nameEnEl.value.trim() || null) : null,
            category: document.getElementById("pf_category").value,
            stock_count: Number(document.getElementById("pf_stock").value) || 0,
            price: Number(document.getElementById("pf_price").value) || 0,
            discount_price: document.getElementById("pf_discount_price").value
                ? Number(document.getElementById("pf_discount_price").value)
                : null,
            description_ar: document.getElementById("pf_description_ar").value.trim(),
            description_en: descEnEl ? (descEnEl.value.trim() || null) : null,
            is_bestseller: document.getElementById("pf_bestseller").checked,
            is_new: document.getElementById("pf_new").checked,
            is_coming_soon: document.getElementById("pf_coming_soon").checked,
            is_active: document.getElementById("pf_active") ? document.getElementById("pf_active").checked : true,
            images: currentImages.filter(Boolean)
        };

        if (!payload.name_ar) {
            showToast("الاسم مطلوب");
            return;
        }

        let error;
        if (id) {
            ({ error } = await supa.from("products").update(payload).eq("id", id));
        } else {
            ({ error } = await supa.from("products").insert(payload));
        }

        if (error) {
            console.error("Product save error:", error);
            showToast("فشل الحفظ: " + error.message);
            return;
        }

        showToast(id ? "تم تعديل المنتج ✅" : "تم إضافة المنتج ✅");
        closeProductForm();
        loadProducts();
    } catch (err) {
        console.error("Product save exception:", err);
        showToast("فشل الحفظ: " + (err.message || "خطأ غير متوقع"));
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "حفظ المنتج";
    }
});

/* ===================== الطلبات ===================== */
async function loadOrders(){
    const { data, error } = await supa.from("orders").select("*").order("created_at", { ascending: false });
    if(error){ showToast("فشل تحميل الطلبات: " + error.message); return; }
    allOrders = data || [];
    renderOrdersTable();
    updateNewOrdersBadge();
}

function updateNewOrdersBadge(){
    const badge = document.getElementById("newOrdersBadge");
    const newCount = allOrders.filter(o=>o.status === "تم الاستلام").length;
    if(newCount > 0){
        badge.textContent = newCount;
        badge.classList.add("show");
    } else {
        badge.classList.remove("show");
    }
}

function renderOrdersTable(){
    const filterVal = document.getElementById("orderStatusFilter").value;
    const filtered = filterVal === "all" ? allOrders : allOrders.filter(o=>o.status === filterVal);
    document.getElementById("ordersCount").textContent = allOrders.length;

    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = filtered.map(o=>{
        const date = new Date(o.created_at).toLocaleString("ar-EG", { dateStyle:"medium", timeStyle:"short" });
        return `
        <tr data-id="${o.id}">
            <td>${o.order_number}</td>
            <td>${o.customer_name}</td>
            <td dir="ltr" style="text-align:right">${o.customer_phone}</td>
            <td>${o.total} ج.م</td>
            <td>
                <select class="status-select" data-id="${o.id}">
                    ${ORDER_STATUSES.map(s=>`<option value="${s}" ${s===o.status?"selected":""}>${s}</option>`).join("")}
                </select>
            </td>
            <td>${date}</td>
            <td><button class="icon-btn view-order-btn" data-id="${o.id}" title="عرض التفاصيل">👁️</button></td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".status-select").forEach(sel=>{
        sel.addEventListener("change", ()=>updateOrderStatus(sel.dataset.id, sel.value));
    });
    tbody.querySelectorAll(".view-order-btn").forEach(btn=>{
        btn.addEventListener("click", ()=>openOrderModal(btn.dataset.id));
    });
}

document.getElementById("orderStatusFilter").addEventListener("change", renderOrdersTable);

async function updateOrderStatus(id, status){
    console.log("Trying to update order id:", id, "to status:", status);

    const { data, error } = await supa
        .from("orders")
        .update({ status })
        .eq("id", id)
        .select();

    console.log("Update result:", { data, error });

    if(error){
        showToast("فشل تحديث الحالة: " + error.message);
        console.error("updateOrderStatus error:", error);
        return;
    }

    if(!data || data.length === 0){
        // محاولة تانية باستخدام order_number لو الـ id فشل
        showToast("⚠️ التحديث بالـ id فشل، جاري المحاولة بطريقة تانية...");
        console.error("updateOrderStatus: no rows matched for id", id);

        // نجيب الطلب من الذاكرة ونحدث بالـ order_number
        const order = allOrders.find(o => o.id === id || o.id === Number(id));
        if(order && order.order_number){
            const { data: data2, error: error2 } = await supa
                .from("orders")
                .update({ status })
                .eq("order_number", order.order_number)
                .select();

            console.log("Update by order_number result:", { data2, error2 });

            if(error2 || !data2 || data2.length === 0){
                showToast("فشل التحديث تمامًا");
                return;
            }
            order.status = status;
            showToast("تم تحديث حالة الطلب ✅");
            updateNewOrdersBadge();
            return;
        }

        showToast("⚠️ التحديث معملش حاجة — الطلب رقم " + id + " مش موجود");
        return;
    }

    const order = allOrders.find(o => o.id === id || o.id === Number(id));
    if(order) order.status = status;
    showToast("تم تحديث حالة الطلب ✅");
    updateNewOrdersBadge();
}

const orderModalOverlay = document.getElementById("orderModalOverlay");
document.getElementById("orderModalClose").addEventListener("click", ()=>orderModalOverlay.classList.remove("show"));
orderModalOverlay.addEventListener("click", e=>{ if(e.target === orderModalOverlay) orderModalOverlay.classList.remove("show"); });

function openOrderModal(id){
    const o = allOrders.find(x=>String(x.id)===String(id));
    if(!o) return;
    const date = new Date(o.created_at).toLocaleString("ar-EG", { dateStyle:"full", timeStyle:"short" });
    const items = Array.isArray(o.items) ? o.items : [];

    document.getElementById("orderModalBody").innerHTML = `
        <div class="order-detail-header">
            <h3>طلب #${o.order_number}</h3>
            <select class="status-select" id="orderModalStatus">
                ${ORDER_STATUSES.map(s=>`<option value="${s}" ${s===o.status?"selected":""}>${s}</option>`).join("")}
            </select>
        </div>
        <div class="order-meta">
            👤 ${o.customer_name}<br>
            📱 ${o.customer_phone}<br>
            📍 ${(o.customer_address||"").replace(/\n/g,"<br>")}<br>
            🕐 ${date}
        </div>
        <table class="order-items-table">
            <thead><tr><th></th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead>
            <tbody>
                ${items.map(i=>{
                    let img = i.image || "";
                    if(!img && i.id && allProducts.length){
                        const p = allProducts.find(x => String(x.id) === String(i.id));
                        if(p && Array.isArray(p.images) && p.images[0]) img = p.images[0];
                    }
                    const thumb = img
                        ? '<img src="'+img+'" class="order-item-thumb" alt="" onerror="this.style.opacity=0.25">'
                        : '<div class="order-item-thumb order-item-thumb-empty"></div>';
                    const lineTotal = (Number(i.qty)||0)*(Number(i.price)||0);
                    return '<tr><td>'+thumb+'</td><td><span class="order-item-id">#'+(i.id||'—')+'</span> '+(i.name||'')+'</td><td>'+i.qty+'</td><td>'+i.price+' ج.م</td><td>'+lineTotal+' ج.م</td></tr>';
                }).join("")}
            </tbody>
        </table>
        <div class="order-total-row">الإجمالي الكلي: ${o.total} ج.م</div>
        <div class="order-actions">
            <button class="secondary-btn" id="printOrderBtn">🖨️ طباعة</button>
            <button class="secondary-btn" id="copyOrderBtn">📋 نسخ الملخص</button>
            <a class="secondary-btn" style="text-decoration:none;display:inline-block" target="_blank"
               href="https://wa.me/2${o.customer_phone.replace(/^0/,"20")}">💬 واتساب العميل</a>
        </div>`;

    document.getElementById("orderModalStatus").addEventListener("change", (e)=>{
        updateOrderStatus(o.id, e.target.value);
        renderOrdersTable();
    });
    document.getElementById("printOrderBtn").addEventListener("click", ()=>window.print());
    document.getElementById("copyOrderBtn").addEventListener("click", ()=>{
        const summary = `طلب #${o.order_number}\nالعميل: ${o.customer_name}\nالموبايل: ${o.customer_phone}\nالعنوان: ${o.customer_address}\n\n` +
            items.map(i=>`${i.name} × ${i.qty} = ${i.qty*i.price} ج.م`).join("\n") +
            `\n\nالإجمالي: ${o.total} ج.م\nالحالة: ${o.status}`;
        navigator.clipboard.writeText(summary).then(()=>showToast("تم نسخ ملخص الطلب 📋"));
    });

    orderModalOverlay.classList.add("show");
}

/* ===================== العملاء ===================== */
let allCustomers = [];

async function loadCustomers(){
    try{
        /* من جدول profiles + الطلبات (من غير service_role) */
        const { data: profilesData, error: profErr } = await supa.from("profiles").select("*").order("created_at", { ascending: false });
        if(profErr) throw profErr;

        const { data: ordersData } = await supa.from("orders").select("user_id, customer_name, customer_phone, created_at");
        const ordersCountByUser = {};
        const guestMap = {}; // عملاء طلبوا من غير حساب

        (ordersData || []).forEach(o=>{
            if(o.user_id){
                ordersCountByUser[o.user_id] = (ordersCountByUser[o.user_id] || 0) + 1;
            } else if(o.customer_phone){
                const key = o.customer_phone.replace(/\D/g, "");
                if(!guestMap[key]){
                    guestMap[key] = {
                        id: "guest-" + key,
                        full_name: o.customer_name || "—",
                        phone: o.customer_phone,
                        email: "—",
                        created_at: o.created_at,
                        orders_count: 0,
                        is_guest: true
                    };
                }
                guestMap[key].orders_count += 1;
                if(new Date(o.created_at) < new Date(guestMap[key].created_at)){
                    guestMap[key].created_at = o.created_at;
                }
            }
        });

        allCustomers = (profilesData || []).map(p=>{
            const isPhoneAccount = (p.email || "").endsWith("@handmade.local");
            return {
                id: p.id,
                full_name: p.full_name || "—",
                phone: p.phone || (isPhoneAccount ? String(p.email||"").replace(/^p/,"").replace("@handmade.local","") : "—"),
                email: isPhoneAccount ? "—" : (p.email || "—"),
                created_at: p.created_at,
                orders_count: ordersCountByUser[p.id] || 0,
                is_guest: false
            };
        });

        // ضيف الضيوف اللي طلبوا من غير تسجيل
        Object.values(guestMap).forEach(g=> allCustomers.push(g));

        allCustomers.sort((a,b)=> new Date(b.created_at) - new Date(a.created_at));
        renderCustomersTable();
    } catch(err){
        console.error("فشل تحميل العملاء:", err);
        showToast("فشل تحميل العملاء: " + err.message);
    }
}

function renderCustomersTable(){
    const search = document.getElementById("customerSearch").value.trim().toLowerCase();
    const tbody = document.getElementById("customersTableBody");
    const filtered = allCustomers.filter(c=>{
        if(!search) return true;
        return (c.full_name||"").toLowerCase().includes(search) || (c.phone||"").includes(search) || (c.email||"").toLowerCase().includes(search);
    });

    document.getElementById("customersCount").textContent = allCustomers.length;

    tbody.innerHTML = filtered.map(c=>{
        const date = new Date(c.created_at).toLocaleString("ar-EG", { dateStyle:"medium", timeStyle:"short" });
        return `
        <tr data-id="${c.id}">
            <td>${c.full_name}</td>
            <td dir="ltr" style="text-align:right">${c.phone}</td>
            <td>${c.email}</td>
            <td>${date}</td>
            <td>${c.orders_count}</td>
            <td><button class="icon-btn view-customer-btn" data-id="${c.id}" title="عرض الطلبات">👁️</button></td>
        </tr>`;
    }).join("");

    tbody.querySelectorAll(".view-customer-btn").forEach(b=>{
        b.addEventListener("click", ()=>openCustomerModal(b.dataset.id));
    });
}

document.getElementById("customerSearch").addEventListener("input", renderCustomersTable);

const customerModalOverlay = document.getElementById("customerModalOverlay");
document.getElementById("customerModalClose").addEventListener("click", ()=>customerModalOverlay.classList.remove("show"));
customerModalOverlay.addEventListener("click", e=>{ if(e.target === customerModalOverlay) customerModalOverlay.classList.remove("show"); });

async function openCustomerModal(userId){
    const c = allCustomers.find(x=>x.id===userId);
    if(!c) return;

    let list = [];
    if(c.is_guest){
        const phone = c.phone;
        const { data: orders } = await supa.from("orders").select("*").eq("customer_phone", phone).order("created_at", { ascending:false });
        list = orders || [];
    } else {
        const { data: orders } = await supa.from("orders").select("*").eq("user_id", userId).order("created_at", { ascending:false });
        list = orders || [];
    }

    document.getElementById("customerModalBody").innerHTML = `
        <h3 style="margin-bottom:14px">${c.full_name} — ${c.phone}</h3>
        <div class="order-meta">
            📧 ${c.email}<br>
            🗓️ تاريخ التسجيل: ${new Date(c.created_at).toLocaleString("ar-EG",{dateStyle:"full",timeStyle:"short"})}<br>
            📦 عدد الطلبات: ${list.length}
        </div>
        ${list.length ? `
        <table class="order-items-table">
            <thead><tr><th>رقم الطلب</th><th>الحالة</th><th>الإجمالي</th><th>التاريخ</th></tr></thead>
            <tbody>
                ${list.map(o=>`<tr>
                    <td>${o.order_number}</td>
                    <td>${o.status}</td>
                    <td>${o.total} ج.م</td>
                    <td>${new Date(o.created_at).toLocaleDateString("ar-EG")}</td>
                </tr>`).join("")}
            </tbody>
        </table>` : `<p style="color:#a9906f;margin-top:10px">لسه معملش أي طلب.</p>`}
    `;
    customerModalOverlay.classList.add("show");
}

/* ===================== التقييمات ===================== */
let allAdminReviews = [];

async function loadReviews(){
    const { data, error } = await supa.from("product_reviews").select("*").order("created_at", { ascending: false });
    if(error){ showToast("فشل تحميل التقييمات: " + error.message); return; }
    allAdminReviews = data || [];
    renderReviewsTable();
}

function renderReviewsTable(){
    const tbody = document.getElementById("reviewsTableBody");
    if(!tbody) return;
    const countEl = document.getElementById("reviewsCount");
    if(countEl) countEl.textContent = allAdminReviews.length;
    if(!allAdminReviews.length){
        tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#a9906f">لا توجد تقييمات بعد</td></tr>`;
        return;
    }
    tbody.innerHTML = allAdminReviews.map(r=>{
        const p = allProducts.find(x => String(x.id) === String(r.product_id));
        const pname = p ? p.name_ar : ("#" + r.product_id);
        const stars = "⭐".repeat(Math.min(5, Math.max(1, Number(r.rating) || 0)));
        const date = r.created_at ? new Date(r.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "—";
        const comment = (r.comment || "—").replace(/</g, "&lt;");
        return `<tr>
            <td>${pname}</td>
            <td>${(r.customer_name || "—").replace(/</g, "&lt;")}</td>
            <td>${stars} (${r.rating})</td>
            <td style="max-width:220px;white-space:normal">${comment}</td>
            <td>${date}</td>
            <td><button class="icon-btn danger delete-review-btn" data-id="${r.id}" title="حذف">🗑️</button></td>
        </tr>`;
    }).join("");
    tbody.querySelectorAll(".delete-review-btn").forEach(b=>{
        b.addEventListener("click", ()=>deleteReview(b.dataset.id));
    });
}

async function deleteReview(id){
    if(!confirm("حذفي التقييم ده؟")) return;
    const { error } = await supa.from("product_reviews").delete().eq("id", id);
    if(error){ showToast("فشل الحذف: " + error.message); return; }
    showToast("تم حذف التقييم ✅");
    loadReviews();
}

/* ===================== كوبونات ===================== */
let allCoupons = [];

async function loadCoupons(){
    const { data, error } = await supa.from("coupons").select("*").order("id", { ascending: false });
    if(error){ showToast("فشل تحميل الكوبونات: " + error.message); return; }
    allCoupons = data || [];
    renderCouponsTable();
}

function renderCouponsTable(){
    const tbody = document.getElementById("couponsTableBody");
    if(!tbody) return;
    document.getElementById("couponsCount").textContent = allCoupons.length;
    tbody.innerHTML = allCoupons.map(c=>{
        const disc = c.discount_type === "percent" ? `${c.discount_value}%` : `${c.discount_value} ج.م`;
        const uses = `${c.used_count || 0}/${c.max_uses || "∞"} · لكل عميل: ${c.max_per_customer ?? 1}`;
        const exp = c.expires_at ? new Date(c.expires_at).toLocaleDateString("ar-EG") : "—";
        const st = !c.is_active ? `<span class="badge" style="background:#fbe4e1;color:#c0392b">موقوف</span>`
            : (c.used_count >= c.max_uses ? `<span class="badge badge-coming">مكتمل</span>`
            : `<span class="badge badge-ok">متاح</span>`);
        return `<tr>
            <td><strong dir="ltr">${c.code}</strong></td>
            <td>${disc}</td>
            <td>${uses}</td>
            <td>${st}</td>
            <td>${exp}</td>
            <td><div class="row-actions">
                <button class="icon-btn edit-coupon-btn" data-id="${c.id}">✏️</button>
                <button class="icon-btn danger delete-coupon-btn" data-id="${c.id}">🗑️</button>
            </div></td>
        </tr>`;
    }).join("") || `<tr><td colspan="6" style="text-align:center;color:#a9906f">لا توجد كوبونات بعد</td></tr>`;

    tbody.querySelectorAll(".edit-coupon-btn").forEach(b=>b.addEventListener("click", ()=>openCouponForm(b.dataset.id)));
    tbody.querySelectorAll(".delete-coupon-btn").forEach(b=>b.addEventListener("click", ()=>deleteCoupon(b.dataset.id)));
}

const couponModalOverlay = document.getElementById("couponModalOverlay");
document.getElementById("addCouponBtn")?.addEventListener("click", ()=>openCouponForm(null));
document.getElementById("couponModalClose")?.addEventListener("click", ()=>couponModalOverlay?.classList.remove("show"));
couponModalOverlay?.addEventListener("click", e=>{ if(e.target===couponModalOverlay) couponModalOverlay.classList.remove("show"); });

function openCouponForm(id){
    document.getElementById("couponForm").reset();
    if(id){
        const c = allCoupons.find(x=>String(x.id)===String(id));
        if(!c) return;
        document.getElementById("couponModalTitle").textContent = "تعديل كوبون";
        document.getElementById("cf_id").value = c.id;
        document.getElementById("cf_code").value = c.code;
        document.getElementById("cf_type").value = c.discount_type || "fixed";
        document.getElementById("cf_value").value = c.discount_value;
        document.getElementById("cf_max_uses").value = c.max_uses ?? 1000;
        const mpc = document.getElementById("cf_max_per_customer");
        if(mpc) mpc.value = c.max_per_customer ?? 1;
        document.getElementById("cf_active").checked = !!c.is_active;
        document.getElementById("cf_note").value = c.note || "";
        if(c.expires_at){
            document.getElementById("cf_expires").value = c.expires_at.slice(0,10);
        }
    } else {
        document.getElementById("couponModalTitle").textContent = "كوبون جديد";
        document.getElementById("cf_id").value = "";
        document.getElementById("cf_active").checked = true;
        document.getElementById("cf_max_uses").value = 1000;
        const mpc = document.getElementById("cf_max_per_customer");
        if(mpc) mpc.value = 1;
    }
    couponModalOverlay.classList.add("show");
}

async function deleteCoupon(id){
    if(!confirm("حذف الكوبون؟")) return;
    const { error } = await supa.from("coupons").delete().eq("id", id);
    if(error){ showToast("فشل الحذف: " + error.message); return; }
    showToast("تم حذف الكوبون");
    loadCoupons();
}

document.getElementById("couponForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const btn = document.getElementById("couponFormSubmit");
    btn.disabled = true;
    try{
        const id = document.getElementById("cf_id").value;
        const payload = {
            code: document.getElementById("cf_code").value.trim().toUpperCase(),
            discount_type: document.getElementById("cf_type").value,
            discount_value: Number(document.getElementById("cf_value").value) || 0,
            max_uses: Number(document.getElementById("cf_max_uses").value) || 1000,
            max_per_customer: Number(document.getElementById("cf_max_per_customer")?.value) || 1,
            is_active: document.getElementById("cf_active").checked,
            note: document.getElementById("cf_note").value.trim() || null,
            expires_at: document.getElementById("cf_expires").value
                ? new Date(document.getElementById("cf_expires").value + "T23:59:59").toISOString()
                : null
        };
        if(!payload.code){ showToast("الكود مطلوب"); return; }
        let error;
        if(id){
            ({ error } = await supa.from("coupons").update(payload).eq("id", id));
        } else {
            ({ error } = await supa.from("coupons").insert(payload));
        }
        if(error){ showToast("فشل الحفظ: " + error.message); return; }
        showToast("تم حفظ الكوبون ✅");
        couponModalOverlay.classList.remove("show");
        loadCoupons();
    } finally {
        btn.disabled = false;
    }
});

/* ===================== إعدادات + إحصائيات ===================== */
async function loadSettings(){
    const { data, error } = await supa.from("site_settings").select("*");
    if(error){ console.warn(error); return; }
    const map = {};
    (data||[]).forEach(r=> map[r.key]=r.value);
    const set = (id,key)=>{ const el=document.getElementById(id); if(el) el.value = map[key]||""; };
    set("set_whatsapp","whatsapp_number");
    set("set_free_shipping","free_shipping_min");
    set("set_wallet","wallet_number");
    set("set_instapay","instapay_handle");
    set("set_announcement","announcement");
    set("set_tg_token","telegram_bot_token");
    set("set_tg_chat","telegram_chat_id");
    set("set_hero_badge","hero_badge");
    set("set_hero_title","hero_title");
    set("set_hero_text","hero_text");
    set("set_hero_btn","hero_btn");
    set("set_hero_image","hero_image");
    set("set_thankyou_title","thankyou_title");
    set("set_thankyou_message","thankyou_message");
}

document.getElementById("settingsForm")?.addEventListener("submit", async (e)=>{
    e.preventDefault();
    const pairs = [
        ["whatsapp_number", "set_whatsapp"],
        ["free_shipping_min", "set_free_shipping"],
        ["wallet_number", "set_wallet"],
        ["instapay_handle", "set_instapay"],
        ["announcement", "set_announcement"],
        ["telegram_bot_token", "set_tg_token"],
        ["telegram_chat_id", "set_tg_chat"],
        ["hero_badge", "set_hero_badge"],
        ["hero_title", "set_hero_title"],
        ["hero_text", "set_hero_text"],
        ["hero_btn", "set_hero_btn"],
        ["hero_image", "set_hero_image"],
        ["thankyou_title", "set_thankyou_title"],
        ["thankyou_message", "set_thankyou_message"],
    ];
    try{
        for(const [key, id] of pairs){
            const value = document.getElementById(id)?.value?.trim() ?? "";
            const { error } = await supa.from("site_settings").upsert({ key, value });
            if(error) throw error;
        }
        showToast("تم حفظ الإعدادات ✅");
    } catch(err){
        showToast("فشل الحفظ: " + err.message);
    }
});

async function loadStats(){
    try{
        const today = new Date();
        today.setHours(0,0,0,0);
        const { data: orders } = await supa.from("orders").select("total, created_at, status");
        const list = orders || [];
        const todayOrders = list.filter(o=> new Date(o.created_at) >= today);
        const revenue = list.reduce((s,o)=> s + (Number(o.total)||0), 0);
        const { count } = await supa.from("products").select("id", { count:"exact", head:true }).eq("is_active", true);
        const el = (id,v)=>{ const n=document.getElementById(id); if(n) n.textContent = v; };
        el("statOrdersToday", todayOrders.length);
        el("statOrdersTotal", list.length);
        el("statRevenue", Math.round(revenue));
        el("statProducts", count ?? allProducts.filter(p=>p.is_active!==false).length);
    } catch(e){ console.warn(e); }
}


/* ===================== حذف الطلبات التجريبية ===================== */
document.getElementById("clearOrdersBtn")?.addEventListener("click", async ()=>{
    if(!confirm("متأكد إنك عايز تحذف كل الطلبات؟ مفيش رجوع.")) return;
    if(!confirm("تأكيد أخير: هتتمسح كل الطلبات من قاعدة البيانات.")) return;
    try{
        const { error } = await supa.from("orders").delete().neq("id", 0);
        if(error) throw error;
        // امسح سجلات استخدام الكوبونات المرتبطة
        await supa.from("coupon_redemptions").delete().neq("id", 0);
        showToast("تم حذف كل الطلبات ✅");
        loadOrders();
        loadStats();
        loadCustomers();
    } catch(err){
        showToast("فشل الحذف: " + err.message);
    }
});

document.getElementById("resetCouponsBtn")?.addEventListener("click", async ()=>{
    if(!confirm("تصفير عداد استخدام كل الكوبونات وسجل الاستخدام؟")) return;
    try{
        await supa.from("coupon_redemptions").delete().neq("id", 0);
        const { data } = await supa.from("coupons").select("id");
        for(const c of (data||[])){
            await supa.from("coupons").update({ used_count: 0 }).eq("id", c.id);
        }
        showToast("تم تصفير الكوبونات ✅");
        loadCoupons();
    } catch(err){
        showToast("فشل: " + err.message);
    }
});
