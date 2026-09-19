/**
 * Lee una lista JSON guardada en localStorage.
 * @param {string} key Clave donde se almacena la lista.
 * @returns {Array} Lista guardada o una lista vacía si no existe.
 */
const readList = (key) => JSON.parse(localStorage.getItem(key) || '[]');

/** Guarda una lista en localStorage como JSON. */
const writeList = (key, value) => localStorage.setItem(key, JSON.stringify(value));

/** Cierra el dialog que contiene al botón pulsado. */
const closeDialog = (event) => event.currentTarget.closest('dialog')?.close();

/** Conecta todos los botones de cierre de dialogs de la página actual. */
const bindDialogCloseButtons = () => {
	document.querySelectorAll('.close-dialog').forEach((button) => button.addEventListener('click', closeDialog));
};

/** Devuelve el siguiente código de orden para el tipo de prenda seleccionado. */
const getNextOrderNumber = (garment, orders) => {
	const garmentPrefixes = { Camisa: 'CAM', Blusa: 'BLU', 'Pantalón': 'PAN', Casacas: 'CAS', Short: 'SHO', Bermuda: 'BER', 'T shirt': 'TSH', 'Polo box': 'POB' };
	const prefix = garmentPrefixes[garment];
	if (!prefix) return '';

	const highestNumber = orders.reduce((highest, order) => {
		const match = String(order.orderNumber || '').match(new RegExp(`^${prefix}-(\\d+)$`));
		return match ? Math.max(highest, Number(match[1])) : highest;
	}, 0);

	return `${prefix}-${String(highestNumber + 1).padStart(3, '0')}`;
};

/** Actualiza el selector de talleres disponibles para una nueva orden. */
const populateWorkshopSelect = (select) => {
	if (!select) return;
	const workshopOptions = readList('workshops').map((workshop) => `<option value="${workshop.id}">${workshop.name} (${workshop.type})</option>`).join('');
	select.innerHTML = `<option value="">Selecciona un taller</option>${workshopOptions}`;
};

/** Pinta todas las órdenes guardadas en el panel principal. */
const renderOrders = (orders) => {
	const emptyTable = document.querySelector('.empty-table');
	if (!emptyTable) return;

	if (!orders.length) {
		emptyTable.className = 'empty-table flex min-h-80 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-center';
		emptyTable.innerHTML = '<div class="mb-4 grid size-14 place-items-center rounded-xl bg-blue-50 text-2xl text-blue-400"><i class="fa-solid fa-clipboard-list" aria-hidden="true"></i></div><h3 class="mb-1 text-sm font-medium text-slate-900">Aún no hay órdenes de producción</h3><p class="text-sm text-slate-400">Cuando registres una orden, su avance aparecerá aquí.</p>';
		return;
	}

	const workshopList = readList('workshops');
	emptyTable.classList.add('text-left', 'items-stretch', 'justify-start', 'p-6', 'border-solid');
	emptyTable.innerHTML = orders.map((order) => {
		const completedStages = ['patternmaking', 'sewing', 'finishing'].filter((stage) => order[stage]).length;
		const assignedWorkshop = workshopList.find((workshop) => workshop.id === order.workshopId);
		return `<article class="border-b border-slate-200 pb-6 last:border-0 last:pb-0"><div class="flex items-start justify-between gap-6"><div><span class="mb-2 inline-block text-xs font-extrabold tracking-wider text-blue-700">${order.orderNumber}</span><h3 class="mb-2 text-xl font-bold text-slate-900">${order.garmentType} · ${order.model}</h3><p class="m-0 text-sm text-slate-500">${order.fabricType} · ${order.quantity} unidades · Curva: ${order.curve}</p></div><span class="shrink-0 rounded-md bg-blue-50 px-3 py-2 text-xs font-extrabold text-blue-700">${completedStages}/3 etapas</span></div><div class="my-6 h-2 overflow-hidden rounded-lg bg-slate-200"><span class="block h-full rounded-lg bg-linear-to-r from-blue-700 to-emerald-500" style="width: ${(completedStages / 3) * 100}%"></span></div><div class="grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-xs text-slate-600"><span><i class="fa-solid fa-industry mr-2 w-4 text-center text-blue-700"></i> Taller: ${assignedWorkshop?.name || 'No asignado'}</span><span><i class="fa-solid fa-venus-mars mr-2 w-4 text-center text-blue-700"></i> Género: ${order.gender || 'Sin definir'}</span><span><i class="fa-solid fa-ruler-horizontal mr-2 w-4 text-center text-blue-700"></i> ${order.fabricWidth}</span><span><i class="fa-solid fa-layer-group mr-2 w-4 text-center text-blue-700"></i> ${order.composition}</span><span><i class="fa-solid fa-scissors mr-2 w-4 text-center text-blue-700"></i> Rizado: ${order.gathering || 'Pendiente'}</span></div><button class="edit-order-button mt-6 self-end rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700" data-order-number="${order.orderNumber}" type="button"><i class="fa-solid fa-pen-to-square mr-2"></i> Editar orden</button></article>`;
	}).join('');
};

/** Configura el formulario y los eventos de creación de órdenes. */
const initializeOrderPage = () => {
	const dialog = document.querySelector('#order-dialog');
	const form = document.querySelector('#order-form');
	const workshopSelect = document.querySelector('#workshop-select');
	const washField = document.querySelector('.wash-field');
	const garmentType = document.querySelector('#garment-type');
	const garmentGender = document.querySelector('#garment-gender');
	const orderNumber = document.querySelector('#order-number');
	const fabricInput = form?.elements.namedItem('fabricType');
	const emptyTable = document.querySelector('.empty-table');
	let editingOrderNumber = null;

	if (!dialog || !form) return;

	const fillOrderForm = (order) => {
		Object.entries(order).forEach(([key, value]) => {
			const field = form.elements.namedItem(key);
			if (!field) return;
			if (field.type === 'checkbox') field.checked = Boolean(value);
			else field.value = value;
		});
		const isDenim = String(order.fabricType || '').toLowerCase().includes('denim');
		washField?.classList.toggle('hidden', !isDenim);
		washField?.querySelector('input').toggleAttribute('required', isDenim
		);
	};

	const openOrderDialog = (order = null) => {
		editingOrderNumber = order?.orderNumber || null;
		form.reset();
		populateWorkshopSelect(workshopSelect);
		if (order) fillOrderForm(order);
		else orderNumber.value = getNextOrderNumber(garmentType.value, readList('productionOrders'));
		dialog.showModal();
	};

	document.querySelectorAll('.new-order-button').forEach((button) => button.addEventListener('click', () => openOrderDialog()));
	emptyTable?.addEventListener('click', (event) => {
		const editButton = event.target.closest('.edit-order-button');
		if (!editButton) return;
		const currentOrder = readList('productionOrders').find((order) => order.orderNumber === editButton.dataset.orderNumber);
		if (currentOrder) openOrderDialog(currentOrder);
	});
	fabricInput?.addEventListener('input', (event) => {
		const isDenim = event.target.value.toLowerCase().includes('denim');
		washField?.classList.toggle('hidden', !isDenim);
		washField?.querySelector('input').toggleAttribute('required', isDenim);
	});
	garmentType?.addEventListener('change', () => {
		orderNumber.value = getNextOrderNumber(garmentType.value, readList('productionOrders'));
		if (garmentType.value === 'Blusa') {
			garmentGender.value = 'Mujer';
		} else if (garmentGender.value === 'Mujer' && garmentType.value) {
			garmentGender.value = '';
		}
	});
	form.addEventListener('submit', (event) => {
		event.preventDefault();
		const order = Object.fromEntries(new FormData(form).entries());
		const savedOrders = readList('productionOrders').filter((savedOrder) => savedOrder.orderNumber !== editingOrderNumber && savedOrder.orderNumber !== order.orderNumber);
		writeList('productionOrders', [...savedOrders, order]);
		localStorage.setItem('productionOrder', JSON.stringify(order));
		renderOrders([...savedOrders, order]);
		dialog.close();
		form.reset();
		washField?.classList.add('hidden');
		editingOrderNumber = null;
	});

	const savedOrders = readList('productionOrders');
	const legacyOrder = localStorage.getItem('productionOrder');
	if (!savedOrders.length && legacyOrder) {
		savedOrders.push(JSON.parse(legacyOrder));
		writeList('productionOrders', savedOrders);
	}
	renderOrders(savedOrders);
	populateWorkshopSelect(workshopSelect);
};

/** Pinta las tarjetas de talleres y calcula sus órdenes y unidades asignadas. */
const renderWorkshops = () => {
	const workshopGrid = document.querySelector('#workshop-grid');
	if (!workshopGrid) return;

	const workshopList = readList('workshops');
	const productionOrders = readList('productionOrders');
	workshopGrid.innerHTML = workshopList.length ? workshopList.map((workshop) => {
		const assignedOrders = productionOrders.filter((order) => order.workshopId === workshop.id);
		const units = assignedOrders.reduce((total, order) => total + Number(order.quantity || 0), 0);
		const progress = Number(workshop.progress || 0);
		return `<div class="workshop-card block w-full rounded-lg border border-blue-200 bg-white p-5 text-left text-inherit shadow-sm transition hover:-translate-y-1 hover:border-blue-600 hover:shadow-lg" data-workshop-id="${workshop.id}"><div class="mb-4 flex items-center justify-between"><span class="grid size-10 place-items-center rounded-lg bg-blue-700 text-base text-white"><i class="fa-solid fa-industry"></i></span><span class="rounded-md bg-blue-50 px-2 py-1 text-xs font-extrabold uppercase text-blue-800">${workshop.type}</span></div><div class="flex min-h-11 items-start justify-between gap-3"><span><h3 class="mb-1 text-lg font-bold text-slate-900">${workshop.name}</h3><span class="block text-xs text-slate-600">${workshop.specialty}</span></span><button class="edit-workshop-button rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 hover:text-blue-700" type="button" data-edit-workshop-id="${workshop.id}" aria-label="Editar perfil de ${workshop.name}"><i class="fa-solid fa-pen"></i></button></div><div class="mt-4 grid gap-1.5 border-y border-slate-200 py-3 text-xs text-slate-600"><span><i class="fa-solid fa-user mr-2 w-3.5 text-blue-700"></i> ${workshop.contact}</span><span><i class="fa-solid fa-phone mr-2 w-3.5 text-blue-700"></i> ${workshop.phone || 'Sin teléfono'}</span></div><div class="mt-4 block"><div class="flex items-baseline justify-between gap-2"><strong class="text-xl text-blue-700">${progress}%</strong><span class="text-right text-xs text-slate-600">avance del procedimiento</span></div><div class="mt-2 block h-2 overflow-hidden rounded-md bg-slate-200"><span class="block h-full rounded-md bg-linear-to-r from-blue-700 to-emerald-500" style="width: ${progress}%"></span></div></div><div class="mt-4 grid grid-cols-3 gap-2"><span class="flex flex-col gap-1"><strong class="text-lg text-blue-700">${assignedOrders.length}</strong><span class="text-xs leading-tight text-slate-600">órdenes asignadas</span></span><span class="flex flex-col gap-1"><strong class="text-lg text-amber-700">${units}</strong><span class="text-xs leading-tight text-slate-600">prendas</span></span><span class="flex flex-col gap-1"><strong class="text-lg text-emerald-700">${workshop.capacity}</strong><span class="text-xs leading-tight text-slate-600">capacidad mensual</span></span></div><button class="mt-4 w-full rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700" type="button" data-open-workshop-id="${workshop.id}">Ver avance y pago</button></div>`;
	}).join('') : '<div class="report-empty"><i class="fa-solid fa-screwdriver-wrench"></i><p>Aún no hay perfiles de talleres.</p><span>Crea un perfil para asignar órdenes y consultar su carga de trabajo.</span></div>';

	workshopGrid.querySelectorAll('[data-open-workshop-id]').forEach((button) => button.addEventListener('click', () => openWorkshopDetail(button.dataset.openWorkshopId)));
	workshopGrid.querySelectorAll('[data-edit-workshop-id]').forEach((button) => button.addEventListener('click', () => openWorkshopForm(button.dataset.editWorkshopId)));
};

/** Abre el editor de avance del taller seleccionado. */
const openWorkshopDetail = (workshopId) => {
	const workshop = readList('workshops').find((item) => item.id === workshopId);
	const detailDialog = document.querySelector('#workshop-detail-dialog');
	const progressRange = document.querySelector('#progress-range');
	const progressOutput = document.querySelector('#progress-output');
	const paymentOutput = document.querySelector('#payment-output');
	const progressNotes = document.querySelector('#progress-notes');
	if (!workshop || !detailDialog) return;

	detailDialog.dataset.workshopId = workshopId;
	document.querySelector('#workshop-detail-title').textContent = workshop.name;
	progressRange.value = workshop.progress || 0;
	progressNotes.value = workshop.notes || '';
	progressOutput.textContent = `${progressRange.value}%`;
	paymentOutput.textContent = formatCurrency(calculatePayment(workshop));
	detailDialog.showModal();
};

/** Formatea un importe monetario en soles peruanos. */
const formatCurrency = (amount) => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' }).format(Number(amount || 0));

/** Calcula el pago proporcional al avance registrado por el auditor. */
const calculatePayment = (workshop, progress = workshop.progress) => Number(workshop.totalPayment || 0) * (Number(progress || 0) / 100);

/** Abre el formulario de perfil con los datos existentes o vacío para uno nuevo. */
const openWorkshopForm = (workshopId = null) => {
	const workshopDialog = document.querySelector('#workshop-dialog');
	const workshopForm = document.querySelector('#workshop-form');
	const title = document.querySelector('#workshop-dialog-title');
	if (!workshopDialog || !workshopForm) return;
	const workshop = workshopId ? readList('workshops').find((item) => item.id === workshopId) : null;
	workshopForm.reset();
	workshopForm.dataset.editingId = workshop?.id || '';
	title.textContent = workshop ? 'Editar perfil de taller' : 'Perfil de taller';
	if (workshop) {
		Object.entries(workshop).forEach(([key, value]) => {
			const field = workshopForm.elements.namedItem(key);
			if (field) field.value = value;
		});
	}
	workshopDialog.showModal();
};

/** Configura los formularios de creación y seguimiento de talleres. */
const initializeWorkshopPage = () => {
	const workshopDialog = document.querySelector('#workshop-dialog');
	const workshopForm = document.querySelector('#workshop-form');
	const detailDialog = document.querySelector('#workshop-detail-dialog');
	const detailForm = document.querySelector('#workshop-detail-form');
	const progressRange = document.querySelector('#progress-range');
	const progressOutput = document.querySelector('#progress-output');
	const paymentOutput = document.querySelector('#payment-output');
	const progressNotes = document.querySelector('#progress-notes');
	if (!workshopDialog || !workshopForm || !detailDialog || !detailForm) return;

	document.querySelector('#new-workshop-button')?.addEventListener('click', () => openWorkshopForm());
	workshopForm.addEventListener('submit', (event) => {
		event.preventDefault();
		const formData = Object.fromEntries(new FormData(workshopForm).entries());
		const editingId = workshopForm.dataset.editingId;
		const currentWorkshops = readList('workshops');
		const existingWorkshop = currentWorkshops.find((workshop) => workshop.id === editingId);
		const profile = { ...existingWorkshop, ...formData, progress: existingWorkshop?.progress || 0, notes: existingWorkshop?.notes || '', paymentDue: calculatePayment({ ...existingWorkshop, ...formData }, existingWorkshop?.progress || 0), id: editingId || `workshop-${Date.now()}` };
		writeList('workshops', editingId ? currentWorkshops.map((workshop) => workshop.id === editingId ? profile : workshop) : [...currentWorkshops, profile]);
		renderWorkshops();
		workshopDialog.close();
		workshopForm.reset();
		workshopForm.dataset.editingId = '';
		document.querySelector('#workshop-dialog-title').textContent = 'Perfil de taller';
	});
	progressRange?.addEventListener('input', () => {
		progressOutput.textContent = `${progressRange.value}%`;
		const workshop = readList('workshops').find((item) => item.id === detailDialog.dataset.workshopId);
		if (workshop) paymentOutput.textContent = formatCurrency(calculatePayment(workshop, progressRange.value));
	});
	detailForm.addEventListener('submit', (event) => {
		event.preventDefault();
		const workshopId = detailDialog.dataset.workshopId;
		const updatedWorkshops = readList('workshops').map((workshop) => workshop.id === workshopId ? { ...workshop, progress: Number(progressRange.value), notes: progressNotes.value.trim(), paymentDue: calculatePayment(workshop, progressRange.value) } : workshop);
		writeList('workshops', updatedWorkshops);
		renderWorkshops();
		detailDialog.close();
	});

	renderWorkshops();
};

/** Inicializa únicamente las funciones que corresponden a la página visible. */
const initializeApplication = () => {
	bindDialogCloseButtons();
	initializeOrderPage();
	initializeWorkshopPage();
};

if (document.readyState === 'loading') {
	document.addEventListener('DOMContentLoaded', initializeApplication, { once: true });
} else {
	initializeApplication();
}
