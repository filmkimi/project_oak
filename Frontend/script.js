// ==========================================
    // 1. Mock Equipment Data
    // ==========================================
    const equipmentData = [
      {
        id: 1,
        name: "MacBook Pro 16 นิ้ว (M2 Max)",
        category: "electronics",
        categoryLabel: "อุปกรณ์ไอที",
        image: "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=500&q=80",
        description: "โน้ตบุ๊กประสิทธิภาพสูง สำหรับงานตัดต่อวิดีโอ ประมวลผลหนัก และงานกราฟิก",
        stock: 3,
        status: "available"
      },
      {
        id: 2,
        name: "Sony Alpha A7 IV (Body)",
        category: "camera",
        categoryLabel: "กล้องถ่ายภาพ",
        image: "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?auto=format&fit=crop&w=500&q=80",
        description: "กล้อง Mirrorless Full-frame ความละเอียด 33MP สำหรับงานภาพนิ่งและวิดีโอ 4K",
        stock: 2,
        status: "available"
      },
      {
        id: 3,
        name: "Epson EB-X06 Projector",
        category: "office",
        categoryLabel: "สื่อการสอน & สำนักงาน",
        image: "https://images.unsplash.com/photo-1517694712202-14dd9538aa97?auto=format&fit=crop&w=500&q=80",
        description: "โปรเจกเตอร์ความสว่าง 3,600 Lumens สำหรับงานนำเสนอ ห้องประชุม และสัมมนา",
        stock: 0,
        status: "unavailable"
      },
      {
        id: 4,
        name: "iPad Pro 12.9” + Apple Pencil",
        category: "electronics",
        categoryLabel: "อุปกรณ์ไอที",
        image: "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?auto=format&fit=crop&w=500&q=80",
        description: "แท็บเล็ตพร้อมปากกา เหมาะสำหรับการวาดภาพ การจดโน้ต และงานออกแบบ",
        stock: 5,
        status: "available"
      },
      {
        id: 5,
        name: "ชุดไมโครโฟนไร้สาย Rode Wireless GO II",
        category: "camera",
        categoryLabel: "กล้องถ่ายภาพ",
        image: "https://images.unsplash.com/photo-1590658268037-6bf12165a8df?auto=format&fit=crop&w=500&q=80",
        description: "ไมค์ไร้สายแบบดูอัลแชนเนล ขนาดกะทัดรัด สำหรับสัมภาษณ์และถ่ายทำวิดีโอ",
        stock: 4,
        status: "available"
      },
      {
        id: 6,
        name: "Digital Multimeter Fluke 179",
        category: "lab",
        categoryLabel: "เครื่องมือทดลอง",
        image: "https://images.unsplash.com/photo-1581092160607-ee22621dd758?auto=format&fit=crop&w=500&q=80",
        description: "เครื่องวัดค่าทางไฟฟ้าอเนกประสงค์ มีความแม่นยำสูง สำหรับห้องปฏิบัติการ",
        stock: 6,
        status: "available"
      }
    ];

    // ==========================================
    // 2. Global States & Elements
    // ==========================================
    let cart = [];
    let currentUser = null;

    const equipmentGrid = document.getElementById("equipment-grid");
    const searchInput = document.getElementById("search-input");
    const categoryFilter = document.getElementById("category-filter");
    const statusFilter = document.getElementById("status-filter");
    const cartBtn = document.getElementById("cart-btn");
    const closeCartBtn = document.getElementById("close-cart-btn");
    const cartSidebar = document.getElementById("cart-sidebar");
    const cartOverlay = document.getElementById("cart-overlay");
    const cartBadge = document.getElementById("cart-badge");
    const cartItemsContainer = document.getElementById("cart-items-container");
    const submitRequestBtn = document.getElementById("submit-request-btn");
    const toast = document.getElementById("toast");
    const toastMessage = document.getElementById("toast-message");
    const successModal = document.getElementById("success-modal");
    const closeModalBtn = document.getElementById("close-modal-btn");
    const itemsCountLabel = document.getElementById("items-count-label");

    // Auth Elements
    const openAuthBtn = document.getElementById("open-auth-btn");
    const authModal = document.getElementById("auth-modal");
    const closeAuthModalBtn = document.getElementById("close-auth-modal");
    const authTabBtns = document.querySelectorAll(".auth-tab-btn");
    const authForms = document.querySelectorAll(".auth-form");
    const loginForm = document.getElementById("login-form");
    const registerForm = document.getElementById("register-form");
    const userProfileBadge = document.getElementById("user-profile-badge");
    const userNameDisplay = document.getElementById("user-name-display");
    const logoutBtn = document.getElementById("logout-btn");

    // ==========================================
    // 3. Render Equipment
    // ==========================================
    function renderEquipment(items) {
      equipmentGrid.innerHTML = "";
      
      if (items.length === 0) {
        equipmentGrid.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 3rem; color: var(--text-muted);">
            <i class="fa-solid fa-box-open" style="font-size: 3rem; margin-bottom: 1rem;"></i>
            <p>ไม่พบรายการอุปกรณ์ที่คุณค้นหา</p>
          </div>
        `;
        itemsCountLabel.innerText = "พบ 0 รายการ";
        return;
      }

      itemsCountLabel.innerText = `กำลังแสดง ${items.length} รายการ`;

      items.forEach(item => {
        const isAvailable = item.status === "available" && item.stock > 0;
        
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <div class="card-img-wrapper">
            <img src="${item.image}" alt="${item.name}">
            <span class="status-badge ${isAvailable ? 'available' : 'unavailable'}">
              ${isAvailable ? 'พร้อมยืม' : 'ถูกยืมหมด'}
            </span>
          </div>
          <div class="card-body">
            <span class="card-category">${item.categoryLabel}</span>
            <h3 class="card-title">${item.name}</h3>
            <p class="card-desc">${item.description}</p>
            <div class="card-footer">
              <div class="stock-info">คงเหลือ: <b>${item.stock}</b> ชิ้น</div>
              <button class="add-to-cart-btn" onclick="addToCart(${item.id})" ${!isAvailable ? 'disabled' : ''} title="เพิ่มลงตะกร้า">
                <i class="fa-solid fa-cart-plus"></i>
              </button>
            </div>
          </div>
        `;
        equipmentGrid.appendChild(card);
      });
    }

    // ==========================================
    // 4. Filters & Search
    // ==========================================
    function filterEquipment() {
      const searchTerm = searchInput.value.toLowerCase();
      const selectedCategory = categoryFilter.value;
      const selectedStatus = statusFilter.value;

      const filtered = equipmentData.filter(item => {
        const matchesSearch = item.name.toLowerCase().includes(searchTerm) || 
                              item.description.toLowerCase().includes(searchTerm);
        const matchesCategory = selectedCategory === "all" || item.category === selectedCategory;
        const matchesStatus = selectedStatus === "all" || item.status === selectedStatus;
        
        return matchesSearch && matchesCategory && matchesStatus;
      });

      renderEquipment(filtered);
    }

    // ==========================================
    // 5. Cart Functions
    // ==========================================
    function addToCart(id) {
      const item = equipmentData.find(prod => prod.id === id);
      if (!item) return;

      const existingItem = cart.find(cartItem => cartItem.id === id);

      if (existingItem) {
        if (existingItem.qty < item.stock) {
          existingItem.qty += 1;
          showToast(`เพิ่มจำนวน ${item.name} ในตะกร้าแล้ว`);
        } else {
          showToast(`ไม่สามารถเพิ่มได้เกินจำนวนสต็อก (${item.stock} ชิ้น)`);
        }
      } else {
        cart.push({ ...item, qty: 1 });
        showToast(`เพิ่ม ${item.name} ลงในตะกร้าแล้ว`);
      }

      updateCartUI();
    }

    function updateCartUI() {
      const totalItems = cart.reduce((sum, item) => sum + item.qty, 0);
      cartBadge.innerText = totalItems;
      submitRequestBtn.disabled = cart.length === 0;

      cartItemsContainer.innerHTML = "";

      if (cart.length === 0) {
        cartItemsContainer.innerHTML = `
          <div style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
            <i class="fa-solid fa-basket-shopping" style="font-size: 2.5rem; color: #ccc; margin-bottom: 0.5rem;"></i>
            <p>ยังไม่มีรายการอุปกรณ์ในตะกร้า</p>
          </div>
        `;
        return;
      }

      cart.forEach(item => {
        const cartItemEl = document.createElement("div");
        cartItemEl.className = "cart-item";
        cartItemEl.innerHTML = `
          <img src="${item.image}" alt="${item.name}" class="cart-item-img">
          <div class="cart-item-details">
            <div class="cart-item-title">${item.name}</div>
            <div class="cart-item-controls">
              <button class="qty-btn" onclick="changeQty(${item.id}, -1)">-</button>
              <span><b>${item.qty}</b></span>
              <button class="qty-btn" onclick="changeQty(${item.id}, 1)">+</button>
            </div>
          </div>
          <button class="remove-item-btn" onclick="removeFromCart(${item.id})" title="ลบรายการ">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        `;
        cartItemsContainer.appendChild(cartItemEl);
      });
    }

    function changeQty(id, change) {
      const cartItem = cart.find(item => item.id === id);
      const stockItem = equipmentData.find(item => item.id === id);

      if (cartItem) {
        const newQty = cartItem.qty + change;
        if (newQty > 0 && newQty <= stockItem.stock) {
          cartItem.qty = newQty;
        } else if (newQty > stockItem.stock) {
          showToast(`ยืมได้ไม่เกินจำนวนคงเหลือ (${stockItem.stock} ชิ้น)`);
        } else if (newQty <= 0) {
          removeFromCart(id);
          return;
        }
      }
      updateCartUI();
    }

    function removeFromCart(id) {
      cart = cart.filter(item => item.id !== id);
      updateCartUI();
      showToast("ลบรายการออกจากตะกร้าแล้ว");
    }

    function toggleCart() {
      cartSidebar.classList.toggle("active");
      cartOverlay.classList.toggle("active");
    }

    function showToast(message) {
      toastMessage.innerText = message;
      toast.classList.add("show");
      setTimeout(() => {
        toast.classList.remove("show");
      }, 2500);
    }

    function handleSubmitBorrow(e) {
      e.preventDefault();
      if (cart.length === 0) return;

      const totalCount = cart.reduce((sum, item) => sum + item.qty, 0);
      const randomReqId = "REQ-" + Math.floor(100000 + Math.random() * 900000);

      document.getElementById("modal-req-id").innerText = randomReqId;
      document.getElementById("modal-req-count").innerText = totalCount;

      cart = [];
      updateCartUI();
      toggleCart();
      document.getElementById("borrow-form").reset();
      
      successModal.classList.add("active");
    }

    // ==========================================
    // 6. Auth Modal, Swapper & Handlers
    // ==========================================
    // สลับ Tab ระหว่าง Login กับ Register
    authTabBtns.forEach(btn => {
      btn.addEventListener("click", () => {
        const targetTab = btn.dataset.tab;
        authTabBtns.forEach(b => b.classList.remove("active"));
        authForms.forEach(f => f.classList.remove("active"));

        btn.classList.add("active");
        document.getElementById(`${targetTab}-form`).classList.add("active");
      });
    });

    openAuthBtn.addEventListener("click", () => authModal.classList.add("active"));
    closeAuthModalBtn.addEventListener("click", () => authModal.classList.remove("active"));

    // Login Submit
    loginForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const email = document.getElementById("login-email").value;
      const userName = email.split('@')[0];
      
      currentUser = userName;
      userNameDisplay.innerText = currentUser;
      
      openAuthBtn.style.display = "none";
      userProfileBadge.classList.add("active");
      authModal.classList.remove("active");
      loginForm.reset();

      showToast(`เข้าสู่ระบบสำเร็จ! ยินดีต้อนรับคุณ ${currentUser}`);
    });

    // Register Submit
    registerForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const name = document.getElementById("reg-fullname").value;
      const password = document.getElementById("reg-password").value;
      const confirmPassword = document.getElementById("reg-confirm-password").value;

      if (password !== confirmPassword) {
        alert("รหัสผ่านและยืนยันรหัสผ่านไม่ตรงกัน!");
        return;
      }

      currentUser = name;
      userNameDisplay.innerText = currentUser;
      
      openAuthBtn.style.display = "none";
      userProfileBadge.classList.add("active");
      authModal.classList.remove("active");
      registerForm.reset();

      showToast(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับ ${name}`);
    });

    // Logout Action
    logoutBtn.addEventListener("click", () => {
      currentUser = null;
      userProfileBadge.classList.remove("active");
      openAuthBtn.style.display = "flex";
      showToast("ออกจากระบบเรียบร้อยแล้ว");
    });

    // ==========================================
    // 7. Event Listeners Initialization
    // ==========================================
    searchInput.addEventListener("input", filterEquipment);
    categoryFilter.addEventListener("change", filterEquipment);
    statusFilter.addEventListener("change", filterEquipment);

    cartBtn.addEventListener("click", toggleCart);
    closeCartBtn.addEventListener("click", toggleCart);
    cartOverlay.addEventListener("click", toggleCart);

    document.getElementById("borrow-form").addEventListener("submit", handleSubmitBorrow);
    closeModalBtn.addEventListener("click", () => successModal.classList.remove("active"));

    window.addEventListener("DOMContentLoaded", () => {
      renderEquipment(equipmentData);
      
      const today = new Date().toISOString().split("T")[0];
      const tomorrow = new Date(Date.now() + 86400000).toISOString().split("T")[0];
      
      document.getElementById("borrow-date").value = today;
      document.getElementById("return-date").value = tomorrow;
    });