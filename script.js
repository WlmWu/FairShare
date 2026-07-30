function isTouchDevice() {
    if ('ontouchstart' in window) {
        return true;
    } else if (window.navigator.maxTouchPoints && window.navigator.maxTouchPoints > 0) {
        return true;
    } else if (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) {
        return true;
    }

    return false;
}

function disableDoubleTapZoom() {
    if (!isTouchDevice()) return;

    let lastTouchEnd = 0;
    document.addEventListener('touchend', (event) => {
        const now = Date.now();
        if (now - lastTouchEnd < 300) {
            event.preventDefault();
        }
        lastTouchEnd = now;
    }, { passive: false });
}

disableDoubleTapZoom();

class Friend {
    static primaryId = 0;
    static nextId = Friend.primaryId;
    static hueOffset = Math.random() * 360;

    constructor(name) {
        this.id = Friend.nextId++;
        this.name = name;
        this.hsl = this.generateColor();
    }

    generateColor() {
        const hue = (Friend.hueOffset + this.id * 137.508) % 360; // use golden angle approximation to distribute hues
        return { h: Math.round(hue), s: 55, l: 42 };
    }

    get rgbString() {
        if (this.id === Friend.primaryId) {
            return 'var(--primary-color)';
        }
        return `hsl(${this.hsl.h}, ${this.hsl.s}%, ${this.hsl.l}%)`;
    }
}

const ItemType = Object.freeze({
    kTypePercent:   0,
    kTypeShare:  1
});

class Item {
    static nextId = 1;

    constructor(name = '', amount) {
        this.id = Item.nextId++;
        this.name = name;
        this.amount = parseFloat(amount);
        this.participants = new Map(); // Map of Friend ID to percentage
        this.unitType = ItemType.kTypePercent;
    }

    setParticipant(friendId, percentage, checked=true) {
        // console.log('set participant', this.id, friendId, percentage);
        if (!Number.isInteger(friendId)) return;
        if (percentage === undefined) percentage = NaN;

        this.participants.set(friendId, { percentage: parseFloat(percentage), checked: checked });
    }

    removeParticipant(friendId) {
        // console.log('rmv participant', this.id, friendId);
        if (!Number.isInteger(friendId)) return;
        this.participants.delete(friendId);
    }

    getParticipantPercentage(friendId) {
        const res = this.participants.get(friendId);
        if (res) return res.percentage;
        else return res;
    }

    getTotalPercentage() {
        return Array.from(this.participants.values()).map(p => p.percentage).reduce((accumulator, currentValue) => {
            return !isNaN(currentValue) ? accumulator + currentValue : accumulator;
        }, 0);
    }

    getParticipantChecked(friendId) {
        const res = this.participants.get(friendId);
        if (res) return res.checked;
        else return res;
    }

    getNumNaNParticipant() {
        return Array.from(this.participants.values())
                        .map(p => p.percentage)
                        .reduce((accumulator, currentValue) => accumulator + (isNaN(currentValue) ? 1 : 0), 0);

    }

    switchUnitType() {
        this.unitType = this.unitType == ItemType.kTypePercent ? ItemType.kTypeShare : ItemType.kTypePercent;
    }

    getUnitType() {
        return this.unitType;
    }

}

let moneyFormat = { currency: '', locale: '' };

function setMoneyFormat(currency, locale) {
  const next = {
    currency: String(currency || '').trim(),
    locale: String(locale || '').trim()
  };

  try {
    buildMoneyFormatter(next).format(0);
  } catch (e) {
    console.warn('Unsupported currency/locale, keeping current format:', next, e.message);
    return;
  }

  moneyFormat = next;
  refreshCurrencyLabels();
}

function buildMoneyFormatter({ currency, locale }) {
  const options = { numberingSystem: 'latn', useGrouping: true };

  if (currency) {
    options.style = 'currency';
    options.currency = currency;
  } else {
    options.minimumFractionDigits = 2;
    options.maximumFractionDigits = 2;
  }

  return new Intl.NumberFormat(locale || undefined, options);
}

function getCurrencyDecimals() {
  try {
    return buildMoneyFormatter(moneyFormat).resolvedOptions().minimumFractionDigits;
  } catch (e) {
    return 2;
  }
}

function getAmountDecimals(value) {
  const natural = getCurrencyDecimals();
  const scaled = value * 10 ** natural;

  return Math.abs(Math.round(scaled) - scaled) < 1e-6 ? natural : natural + 2;
}

function formatAmountParts(amount) {
  const value = Number(amount);
  const safe = isNaN(value) ? 0 : value;
  const decimals = getAmountDecimals(safe);

  const formatter = new Intl.NumberFormat(moneyFormat.locale || undefined, {
    numberingSystem: 'latn',
    useGrouping: true,
    style: moneyFormat.currency ? 'currency' : 'decimal',
    currency: moneyFormat.currency || undefined,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });

  return formatter.formatToParts(safe);
}

function formatMoney(amount) {
  const value = Number(amount);
  const safe = isNaN(value) ? 0 : value;

  try {
    const parts = formatAmountParts(safe);
    const symbol = parts.filter(part => part.type === 'currency').map(part => part.value).join('');
    const number = parts.filter(part => part.type !== 'currency').map(part => part.value).join('').trim();

    return `${symbol}${number}`;
  } catch (e) {
    return `$${safe.toFixed(2)}`;
  }
}

function getCurrencySymbol() {
  try {
    const parts = buildMoneyFormatter(moneyFormat).formatToParts(0);
    return parts.find(part => part.type === 'currency')?.value || '$';
  } catch (e) {
    return '$';
  }
}

function refreshCurrencyLabels() {
  $('.currency-symbol, .currency-prefix').text(getCurrencySymbol());
}

function formatComputedHint(amount) {
  const value = Number(amount);
  const safe = isNaN(value) ? 0 : value;
  const decimals = getAmountDecimals(safe);

  try {
    return new Intl.NumberFormat(moneyFormat.locale || undefined, {
      numberingSystem: 'latn',
      useGrouping: false,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    }).format(safe);
  } catch (e) {
    return String(safe);
  }
}

function formatPercentHint(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return '';
  }

  return String(Number(number.toFixed(4)));
}

const BILL_STORAGE_KEY = 'shareceipt.bill';
const BILL_STORAGE_VERSION = 1;
const BILL_SAVE_DELAY_MS = 250;

function readStoredBill() {
  try {
    const value = sessionStorage.getItem(BILL_STORAGE_KEY);

    if (!value) {
      return null;
    }

    const snapshot = JSON.parse(value);

    return snapshot && snapshot.version === BILL_STORAGE_VERSION ? snapshot : null;
  } catch (e) {
    console.warn('Could not read the saved bill.', e);
    return null;
  }
}

function writeStoredBill(snapshot) {
  try {
    sessionStorage.setItem(BILL_STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Could not save the bill for reload.', e);
  }
}

function amountToJson(value) {
  return Number.isFinite(value) ? value : null;
}

function amountFromJson(value) {
  return value === null || value === undefined ? NaN : Number(value);
}

let modalResolver = null;

function showAppModal({ title = '', message = '', input = null }) {
    if (modalResolver) {
        closeAppModal();
    }

    const body = $('#app-modal-body');
    body.empty();

    if (title) {
        body.append($('<h2 id="app-modal-title"></h2>').text(title));
    }

    String(message).split('\n').filter(line => line !== '').forEach(line => {
        body.append($('<p></p>').text(line));
    });

    let editorInput = null;
    if (input) {
        editorInput = $('<input type="text" class="modal-editor-input" autocomplete="off">')
        .attr('placeholder', input.placeholder || '')
        .val(input.value || '');
        body.append(editorInput);
    }

    const modal = $('#app-modal');
    modal.prop('hidden', false);
    requestAnimationFrame(() => {
        modal.addClass('is-open');
        setTimeout(() => {
        const target = editorInput || $('#app-modal-close');
        target.trigger('focus');
        if (editorInput) {
            editorInput[0].select();
        }
        }, 0);
    });

    return new Promise(resolve => {
        modalResolver = { resolve, onInput: input?.onInput };
    });
}

function closeAppModal() {
    const modal = $('#app-modal');

    if (modal.prop('hidden')) {
        return;
    }

    const pending = modalResolver;
    modalResolver = null;
    modal.removeClass('is-open');
    setTimeout(() => {
        if (!modal.hasClass('is-open')) {
            modal.prop('hidden', true);
        }
    }, 180);

    if (pending) {
        pending.resolve();
    }
}

function showAppAlert(title, message = '') {
    return showAppModal({ title, message });
}

function showAppEditor(title, { value = '', placeholder = '', onInput } = {}) {
    return showAppModal({ title, input: { value, placeholder, onInput } });
}

function attachAppModalEvents() {
    const modal = $('#app-modal');

    $('#app-modal-close').on('click', () => closeAppModal());
    modal.on('click', (event) => {
        if (event.target === event.currentTarget) {
            closeAppModal();
        }
    });
    modal.on('input', '.modal-editor-input', (event) => {
        modalResolver?.onInput?.($(event.target).val());
    });
    modal.on('keydown', '.modal-editor-input', (event) => {
        if (event.key === 'Enter') {
            event.preventDefault();
            closeAppModal();
        }
    });
    $(document).on('keydown', (event) => {
        if (event.key === 'Escape' && modal.hasClass('is-open')) {
            closeAppModal();
        }
    });
}

const API_KEY_STORAGE_KEY = 'apiKey';
const MODEL_STORAGE_KEY = 'shareceipt.geminiModel';
const DEFAULT_MODEL_CHOICE = 'flash';
const GEMINI_MODELS = {
    flash: { label: 'Flash', apiModel: 'gemini-flash-latest', hint: 'More detailed' },
    lite: { label: 'Lite', apiModel: 'gemini-flash-lite-latest', hint: 'Quicker' }
};

function getSelectedModelChoice() {
    const storedChoice = localStorage.getItem(MODEL_STORAGE_KEY);
    return Object.hasOwn(GEMINI_MODELS, storedChoice) ? storedChoice : DEFAULT_MODEL_CHOICE;
}

function getSelectedModel() {
    return GEMINI_MODELS[getSelectedModelChoice()].apiModel;
}

function setSelectedModelChoice(choice) {
    const nextChoice = Object.hasOwn(GEMINI_MODELS, choice) ? choice : DEFAULT_MODEL_CHOICE;

    localStorage.setItem(MODEL_STORAGE_KEY, nextChoice);
    renderModelChoice(nextChoice);
    refreshKeyChip();
}

function renderModelChoice(choice) {
    $('input[name="geminiModel"]').each((_, input) => {
        input.checked = input.value === choice;
    });
    $('#model-choice-hint').text(GEMINI_MODELS[choice].hint);
}

function refreshKeyChip() {
    const hasKey = Boolean((localStorage.getItem(API_KEY_STORAGE_KEY) || '').trim());

    $('#key-chip-model').text(GEMINI_MODELS[getSelectedModelChoice()].label);
    $('#key-chip-check').prop('hidden', !hasKey);
    $('#update-api-key-btn').toggleClass('is-set', hasKey);
    $('#key-modal-clear').prop('disabled', !hasKey);
}

function writeApiKey(value) {
    const key = String(value).trim();

    if (key) {
        localStorage.setItem(API_KEY_STORAGE_KEY, key);
    } else {
        localStorage.removeItem(API_KEY_STORAGE_KEY);
    }

    refreshKeyChip();
}

let keyModalResolver = null;

function openKeyModal() {
    const modal = $('#key-modal');
    const input = $('#key-modal-input');

    input.val(localStorage.getItem(API_KEY_STORAGE_KEY) || '');
    renderModelChoice(getSelectedModelChoice());
    refreshKeyChip();
    modal.prop('hidden', false);
    requestAnimationFrame(() => {
        modal.addClass('is-open');
        setTimeout(() => input.trigger('focus'), 0);
    });

    return new Promise(resolve => {
        keyModalResolver = resolve;
    });
}

function closeKeyModal() {
    const modal = $('#key-modal');

    if (modal.prop('hidden')) {
        return;
    }

    const resolve = keyModalResolver;
    keyModalResolver = null;
    modal.removeClass('is-open');
    setTimeout(() => {
        if (!modal.hasClass('is-open')) {
        modal.prop('hidden', true);
        }
    }, 180);

    if (resolve) {
        resolve();
    }
}

function attachKeyModalEvents() {
    const modal = $('#key-modal');

    $('#key-modal-close').on('click', closeKeyModal);
    modal.on('click', (event) => {
        if (event.target === event.currentTarget) {
        closeKeyModal();
        }
    });
    $(document).on('keydown', (event) => {
        if (event.key === 'Escape' && modal.hasClass('is-open')) {
        closeKeyModal();
        }
    });

    $('#key-modal-input').on('input', (event) => writeApiKey($(event.target).val()));
    $('#key-modal-input').on('keydown', (event) => {
        if (event.key === 'Enter') {
        event.preventDefault();
        closeKeyModal();
        }
    });

    $('#key-modal-input').on('pointerdown', () => {
        setTimeout(() => $('#key-modal-input')[0].select(), 0);
    });

    $('#key-modal-clear').on('click', () => {
        $('#key-modal-input').val('');
        writeApiKey('');
        $('#key-modal-input').trigger('focus');
    });

    $('#model-choice-field').on('click', '.model-choice-control', (event) => {
        event.preventDefault();
        setSelectedModelChoice(getSelectedModelChoice() === 'flash' ? 'lite' : 'flash');
    });
}

class FriendManager {
    constructor() {
        this.friends = new Map();
        this.items = new Map();
        this.friendListElement = $('#friends-list');
        this.itemsListElement = $('#items-list');
        this.receiptPreviewUrl = null;
        this.pendingReceiptPreviewFile = null;
        this.isRestoringBill = false;
        this.billSaveTimer = 0;
        if (!this.restoreBill()) {
            this.initializeFriends();
            this.initializeItems();
        }
        this.attachEventListeners();
    }

    initializeFriends() {
        this.friendListElement.empty();
        this.addFriend('me');
    }
    initializeItems() {
        this.itemsListElement.empty();
        this.addItem();
    }

    restoreBill() {
        const snapshot = readStoredBill();

        if (!snapshot) {
            return false;
        }

        this.isRestoringBill = true;

        try {
            return this.applyBillSnapshot(snapshot);
        } catch (e) {
            console.warn('Could not restore the saved bill.', e);
            this.friends = new Map();
            this.items = new Map();
            Friend.nextId = Friend.primaryId;
            Item.nextId = 1;
            this.friendListElement.empty();
            this.itemsListElement.empty();
            $('#settlement-paid-inputs').empty();
            return false;
        } finally {
            this.isRestoringBill = false;
        }
    }

    applyBillSnapshot(snapshot) {
        const savedFriends = Array.isArray(snapshot.friends) ? snapshot.friends : [];
        const savedItems = Array.isArray(snapshot.items) ? snapshot.items : [];

        if (!savedFriends.some(entry => Number(entry?.id) === Friend.primaryId)) {
            return false;
        }

        const friends = new Map();

        if (Number.isFinite(snapshot.hueOffset)) {
            Friend.hueOffset = snapshot.hueOffset;
        }

        savedFriends.forEach(entry => {
            const id = Number(entry?.id);

            if (!Number.isInteger(id) || friends.has(id)) {
            return;
            }

            const friend = new Friend(String(entry?.name ?? ''));
            friend.id = id;
            friend.hsl = friend.generateColor();
            friends.set(id, friend);
        });

        const items = new Map();
        const collapsedItemIds = new Set();
        savedItems.forEach(entry => {
            const id = Number(entry?.id);

            if (!Number.isInteger(id) || items.has(id)) {
            return;
            }

            const item = new Item(String(entry?.name ?? ''), amountFromJson(entry?.amount));
            item.id = id;
            item.unitType = entry?.unitType === ItemType.kTypeShare ? ItemType.kTypeShare : ItemType.kTypePercent;

            const savedParticipants = Array.isArray(entry?.participants) ? entry.participants : [];
            savedParticipants.forEach(participant => {
            const fid = Number(participant?.fid);

            if (!friends.has(fid)) {
                return;
            }

            item.setParticipant(fid, amountFromJson(participant?.percentage), participant?.checked !== false);
            });

            if (entry?.collapsed) {
            collapsedItemIds.add(id);
            }

            items.set(id, item);
        });

        Friend.nextId = Array.from(friends.keys()).reduce((next, id) => Math.max(next, id + 1), Friend.primaryId);
        Item.nextId = Array.from(items.keys()).reduce((next, id) => Math.max(next, id + 1), 1);

        setMoneyFormat(snapshot.currency, snapshot.locale);

        this.friends = friends;
        this.items = items;
        this.friendListElement.empty();
        this.itemsListElement.empty();
        this.updateFriendList();
        this.updateItemsList();

        $('#total-amount-input').val(typeof snapshot.totalAmountInput === 'string' ? snapshot.totalAmountInput : '');
        $('#total-amount-additional').val(typeof snapshot.additionalFee === 'string' ? snapshot.additionalFee : '');

        this.items.forEach((item, itemId) => {
            item.participants.forEach((participant, fid) => {
            const checkbox = $(`#item-${itemId}-friend-${fid}`)[0];

            if (checkbox) {
                checkbox.checked = participant.checked !== false;
            }
            });

            if (collapsedItemIds.has(itemId)) {
            $(`#item-collapse-btn-${itemId}`).click();
            }
        });

        this.applySettlementSnapshot(snapshot);
        this.calculate();
        return true;
    }

    applySettlementSnapshot(snapshot) {
        const savedRows = Array.isArray(snapshot.settlement) ? snapshot.settlement : [];

        savedRows.forEach(row => {
            const input = $(`.settlement-paid[data-fid="${Number(row?.fid)}"]`);
            const checkbox = input.closest('.settlement-paid-row').find('.settlement-checkbox')[0];

            if (!input.length || !checkbox) {
            return;
            }

            checkbox.checked = row?.checked === true;
            input[0].disabled = !checkbox.checked;
            input.val(checkbox.checked && typeof row?.paid === 'string' ? row.paid : '');
            input.attr('placeholder', checkbox.checked ? '' : '0');
        });

        if (snapshot.settlementOpen) {
            $('#settlement-section').addClass('show');
        }
    }

    createBillSnapshot() {
        return {
            version: BILL_STORAGE_VERSION,
            savedAt: Date.now(),
            currency: moneyFormat.currency,
            locale: moneyFormat.locale,
            hueOffset: Friend.hueOffset,
            friends: Array.from(this.friends.values(), friend => ({
            id: friend.id,
            name: friend.name
            })),
            items: Array.from(this.items.values(), item => ({
            id: item.id,
            name: item.name,
            amount: amountToJson(item.amount),
            unitType: item.unitType,
            collapsed: this.itemsListElement.find(`.item[data-id="${item.id}"]`).hasClass('is-collapsed'),
            participants: Array.from(item.participants, ([fid, participant]) => ({
                fid,
                percentage: amountToJson(participant.percentage),
                checked: participant.checked !== false
            }))
            })),
            totalAmountInput: String($('#total-amount-input').val() ?? ''),
            additionalFee: String($('#total-amount-additional').val() ?? ''),
            settlementOpen: $('#settlement-section').hasClass('show'),
            settlement: $('.settlement-paid').map((_, el) => {
            const checkbox = $(el).closest('.settlement-paid-row').find('.settlement-checkbox')[0];

            return {
                fid: parseInt($(el).data('fid'), 10),
                checked: Boolean(checkbox && checkbox.checked),
                paid: String($(el).val() ?? '')
            };
            }).get()
        };
    }

    scheduleBillSave() {
        if (this.isRestoringBill) {
            return;
        }

        if (this.billSaveTimer) {
            window.clearTimeout(this.billSaveTimer);
        }

        this.billSaveTimer = window.setTimeout(() => {
            this.billSaveTimer = 0;
            this.saveBillNow();
        }, BILL_SAVE_DELAY_MS);
        }

        saveBillNow() {
        if (this.isRestoringBill) {
            return;
        }

        if (this.billSaveTimer) {
            window.clearTimeout(this.billSaveTimer);
            this.billSaveTimer = 0;
        }

        writeStoredBill(this.createBillSnapshot());
    }

    addFriend(name) {
        const friend = new Friend(name);
        this.friends.set(friend.id, friend);
        this.updateFriendList();
    }

    isPrimaryFriend(friend) {
        return friend && friend.id === Friend.primaryId;
    }

    getFriendInitials(friend) {
        if (this.isPrimaryFriend(friend)) {
            return 'ME';
        }
        return friend.name.substring(0, 2).toUpperCase();
    }

    escapeAttribute(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/"/g, '&quot;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }

    removeFriend(id) {
        const friendId = parseInt(id, 10);
        const friend = this.friends.get(friendId);
        if (this.isPrimaryFriend(friend)) {
            return;
        }
        this.friends.delete(friendId);
        this.updateFriendList();
    }

    updateFriendList() {
        const existingFriendIds = new Set(this.friends.keys());
        this.friendListElement.children('.friend').each((_, div) => {
            const id = parseInt($(div).find('.friend-name').data('id'), 10);
            if (!existingFriendIds.has(id)) {
                $(div).remove();
            }
        });

        this.friends.forEach(friend => {
            let friendElement = this.friendListElement.find(`.friend-name[data-id="${friend.id}"]`);
            if (!friendElement.length) {
                const initials = this.getFriendInitials(friend);
                const deleteButton = this.isPrimaryFriend(friend) ? '' : '<button class="delete-btn" data-id="' + friend.id + '"><i class="fa-solid fa-xmark"></i></button>';

                this.friendListElement.append(`
                    <div class="friend" data-id="${friend.id}">
                        <div class="friend-avatar-container">
                            <div class="friend-avatar" style="background-color: ${friend.rgbString};">
                                ${initials}
                            </div>
                            ${deleteButton}
                        </div>
                        <span class="friend-name" data-id="${friend.id}">${friend.name}</span>
                    </div>
                `);
            } else {
                friendElement[0].innerHTML = friend.name;
                $(friendElement).closest('.friend').find('.friend-avatar').text(this.getFriendInitials(friend));
            }
        });

        this.bindFriendEvents();
        this.updateSettlementFriends();
        this.updateItemFriends();
    }

    updateItemFriends() {
        const numFriends = this.friends.size;

        this.itemsListElement.find('.item').each((index, itemDiv) => {
            const itemId = parseInt($(itemDiv).find('input[type="text"]').attr('id').split('-').pop());
            let item = this.items.get(itemId);

            const itemFriendsDiv = $(`#item-friends-${itemId}`);

            // remove friends removed
            const existingFriendIds = new Set(this.friends.keys());
            itemFriendsDiv.children('.item-friend').each((_, div) => {
                let friendId = parseInt($(div).find('label').attr('for').split('-')[3]);
                if (!existingFriendIds.has(friendId)) {
                    $(div).remove();
                    item.removeParticipant(friendId);
                }
            });

            // add friends added
            this.friends.forEach(friend => {
                if (!itemFriendsDiv.find(`.item-friend input[id="item-${itemId}-friend-${friend.id}"]`).length) {
                    itemFriendsDiv.append(`
                        <div class="item-friend">
                            <input type="checkbox" id="item-${itemId}-friend-${friend.id}" checked>
                            <label for="item-${itemId}-friend-${friend.id}" class="item-friend-name" style="border: 1.5px solid black; border-radius: 6px; background-color:${friend.rgbString};" >
                            </label>
                        </div>
                    `);
                }
            });

            itemFriendsDiv.children('.item-friend').each((_, div) => {
                let itemId = parseInt($(div).find('label').attr('for').split('-')[1]);
                let friendId = parseInt($(div).find('label').attr('for').split('-')[3]);
                let item = this.items.get(itemId)
                const percentage = item.getParticipantPercentage(friendId);
                let friend = this.friends.get(friendId);

                const initials = this.getFriendInitials(friend);

                $($(div).find('label')).html( `
                    <div class="participant-row-inner">
                        <div class="participant-avatar" style="background-color: ${friend.rgbString};" title="${friend.name}">
                            ${initials}
                        </div>
                        <div class="participant-input-wrapper">
                            <input type="number" value="${percentage}" min="0" max="100" step="1" class="percentage-input" ${item.getParticipantChecked(friendId) === false ? "disabled" : ""}>
                            <span class="unit-text">${item.getUnitType() == ItemType.kTypePercent ? '%' : 'share(s)'}</span>
                        </div>
                        <div class="participant-toggle-box">
                            <i class="fa-solid fa-minus active-icon"></i>
                            <i class="fa-solid fa-plus inactive-icon"></i>
                        </div>
                    </div>
                `);
                // Sync input value display
                const pInput = $(div).find('.percentage-input');
                if (percentage !== undefined && !isNaN(percentage)) {
                    pInput.val(percentage);
                } else {
                    pInput.val('');
                }
                // $(div).find('input[type="number"]')[0].placeholder = Math.round(100 / numFriends * 100) / 100;
                item.setParticipant(friendId, percentage, percentage === undefined ? true : item.getParticipantChecked(friendId));
                this.bindItemEvents();
            });
        });
        this.calculate();
    }

    addItem(name = '', amount) {
        const item = new Item(name, amount);
        this.items.set(item.id, item)
        this.updateItemsList();
    }

    removeItem(id) {
        this.items.delete(id);
        this.updateItemsList();
    }

    updateItemsList() {
        const existingItems = new Set(this.items.keys());
        this.itemsListElement.children('.item').each((_, div) => {
            const id = parseInt($(div).data('id'), 10);
            if (!existingItems.has(id)) {
                $(div).remove();
            }
        });

        // Toggle empty-state class on card body
        const $cardBody = this.itemsListElement.closest('.card-body');
        if (this.items.size === 0) {
            $cardBody.addClass('empty-state');
        } else {
            $cardBody.removeClass('empty-state');
        }

        this.items.forEach((item, key) => {
            let itemElement = this.itemsListElement.find(`.item[data-id="${item.id}"]`);
            if (!itemElement.length) {
                this.itemsListElement.append(`
                    <div class="item" data-id="${item.id}">
                        <!-- Dummy elements to satisfy legacy script assumptions -->
                        <label style="display: none;"></label>
                        <div class="item-head" style="display: none;">&emsp;</div>

                        <!-- Expanded header: caret + inputs + delete -->
                        <div class="item-header-row item-expanded-row">
                            <button id="item-collapse-btn-${item.id}" class="collapse-btn collapse-green-btn" data-bs-toggle="collapse" data-bs-target="#item-container-${item.id}" aria-expanded="true" aria-controls="item-container-${item.id}">
                                <i class="fa-solid fa-caret-up"></i>
                            </button>

                            <div class="item-name-wrapper">
                                <input type="text" class="item-name" id="item-name-${item.id}" value="${item.name}" placeholder="Items">
                            </div>

                            <div class="item-amount-wrapper">
                                <input type="number" class="item-amount" id="item-amount-${item.id}" min="0" step="0.01" value="${item.amount || ''}" placeholder="Price">
                            </div>

                            <button class="delete-btn delete-green-btn"><i class="fa-solid fa-xmark"></i></button>
                        </div>

                        <!-- Collapsed header: caret + text + bold price + delete -->
                        <div class="item-header-row item-collapsed-row">
                            <button class="collapse-btn collapse-green-btn collapsed-toggle-btn" data-bs-toggle="collapse" data-bs-target="#item-container-${item.id}" aria-expanded="false">
                                <i class="fa-solid fa-caret-down"></i>
                            </button>
                            <span class="item-collapsed-name">${item.name || 'Untitled'}</span>
                            <span class="item-collapsed-price">${item.amount ? formatMoney(item.amount) : ''}</span>
                            <button class="delete-btn delete-green-btn"><i class="fa-solid fa-xmark"></i></button>
                        </div>

                        <div class="item-container collapse show" id="item-container-${item.id}">
                            <div class="item-details-body">
                                <div class="item-unit-row">
                                    <button class="btn-unit-toggle unit-btn" ontouchstart=""><i class="fa-solid fa-repeat"></i> Unit</button>
                                </div>
                                <div id="item-friends-${item.id}" class="item-friends"></div>
                            </div>
                        </div>
                    </div>
                `);
            } else {
                // Update collapsed row text/price in real-time
                const $collRow = itemElement.find('.item-collapsed-row');
                $collRow.find('.item-collapsed-name').text(item.name || 'Untitled');
                $collRow.find('.item-collapsed-price').text(item.amount ? formatMoney(item.amount) : '');
            }
        });
        this.updateItemFriends();
    }

    bindFriendEvents() {
        this.friendListElement.off('click', '.delete-btn').on('click', '.delete-btn', (event) => {
            const id = $(event.currentTarget).data('id');
            this.removeFriend(id);
        });
        this.friendListElement.off('click', '.friend-name').on('click', '.friend-name', (event) => {
            const id = $(event.currentTarget).data('id');
            this.editName(id);
        });
        this.friendListElement.off('click', '.friend-avatar').on('click', '.friend-avatar', (event) => {
            const id = $(event.currentTarget).closest('.friend').data('id');
            this.editName(id);
        });
    }

    bindItemEvents() {
        $('#items-list .item .delete-btn').off('click').on('click', (e) => {
            const itemId = parseInt($(e.target).closest('.item').data('id'));
            this.removeItem(itemId);
        });

        $('#items-list .item .item-container').off('hide.bs.collapse').on('hide.bs.collapse', (e) => {
            const itemdiv = $(e.target).closest('.item');
            const name = itemdiv.find('.item-name').val() || 'Untitled';
            const amount = itemdiv.find('.item-amount').val();

            itemdiv.find('.item-collapsed-name').text(name);
            itemdiv.find('.item-collapsed-price').text(amount ? formatMoney(amount) : '');
            itemdiv.addClass('is-collapsed');
            itemdiv.find('.item-expanded-row .collapse-btn i')
                .removeClass('fa-caret-up')
                .addClass('fa-caret-down');
            this.scheduleBillSave();
        });

        $('#items-list .item .item-container').off('show.bs.collapse').on('show.bs.collapse', (e) => {
            const itemdiv = $(e.target).closest('.item');
            itemdiv.removeClass('is-collapsed');
            itemdiv.find('.item-expanded-row .collapse-btn i')
                .removeClass('fa-caret-down')
                .addClass('fa-caret-up');
            this.scheduleBillSave();
        });

        $('#items-list .item .item-collapsed-row').off('click').on('click', (e) => {
            if ($(e.target).closest('.collapse-btn, .delete-btn').length) {
                return;
            }
            $(e.currentTarget).find('.collapsed-toggle-btn').trigger('click');
        });

        $('#items-list .item').off('click.collapsedPadding').on('click.collapsedPadding', (e) => {
            const item = $(e.currentTarget);
            if (!item.hasClass('is-collapsed')) return;
            if ($(e.target).closest('.item-header-row, .collapse-btn, .delete-btn').length) {
                return;
            }
            item.find('.collapsed-toggle-btn').trigger('click');
        });

        $('#items-list .item .item-expanded-row').off('click').on('click', (e) => {
            if ($(e.target).closest('input, .collapse-btn, .delete-btn').length) {
                return;
            }
            $(e.currentTarget).find('.collapse-btn').trigger('click');
        });

        $('#items-list .item .distribute-btn').off('click').on('click', (e) => {
            const itemId = parseInt($(e.target).closest('.item').data('id'));
            this.autoDistribute(itemId);
        });

        $('#items-list .item .unit-btn').off('click').on('click', (e) => {
            const $icon = $(e.currentTarget).find('i');
            $icon.removeClass('unit-spin');
            void $icon[0].offsetWidth;
            $icon.addClass('unit-spin').one('animationend', () => {
                $icon.removeClass('unit-spin');
            });

            const itemId = parseInt($(e.target).closest('.item').data('id'));
            this.switchUnit(itemId);
        });

        $('#items-list .item .item-name').off('input').on('input', (e) => {
            const itemID = parseInt(e.target.id.split('-')[2]);
            const itemVal = $(e.target).val();
            this.items.get(itemID).name = itemVal;
            // Sync collapsed row
            $(e.target).closest('.item').find('.item-collapsed-name').text(itemVal || 'Untitled');
            this.calculate();
        });

        $('#items-list .item-friends input[type="number"]').off('focus').on('focus', (e) => {
            const itemId = parseInt($(e.target.closest('label')).attr('for').split('-')[1]);
            const friendId = parseInt($(e.target.closest('label')).attr('for').split('-')[3]);
            $(e.target).val('');

            this.items.get(itemId).setParticipant(friendId, NaN);
            this.calculate();
        });

        $('#items-list input[type="number"]').off('input').on('input', (e) => {
            const itemId = parseInt(e.target.id.split('-')[2]);
            const val = parseFloat(e.target.value);
            if (!isNaN(itemId) && this.items.get(itemId)) {
                this.items.get(itemId).amount = val;
                // Sync collapsed row price
                const priceStr = e.target.value ? formatMoney(e.target.value) : '';
                $(e.target).closest('.item').find('.item-collapsed-price').text(priceStr);
            }
            this.calculate();
        });

        $('#items-list .item-friends input[type="checkbox"]').off('change').on('change', function(e) {
            const itemId = parseInt(e.target.id.split('-')[1]);
            const friendId = parseInt(e.target.id.split('-')[3]);
            const check = $(`#${e.target.id}`)[0].checked;
            const input = $(`#${e.target.id}`).closest('.item-friend').find('.percentage-input')[0];
            input.disabled = !check;
            input.value = check ? NaN : 0 ;
            this.items.get(itemId).setParticipant(friendId, input.value, check);
            this.calculate();
        }.bind(this));

        $('#items-list .item-friends .participant-input-wrapper').off('click').on('click', function(e) {
            const itemFriend = $(e.currentTarget).closest('.item-friend');
            const checkbox = itemFriend.find('input[type="checkbox"]')[0];
            if (checkbox.checked) return;

            e.preventDefault();
            checkbox.checked = true;
            $(checkbox).trigger('change');
            itemFriend.find('.percentage-input').trigger('focus');
        });

        $('#items-list .item-friends .percentage-input').off('input').on('input', function(e) {
            const itemId = parseInt($(e.target).closest('label').attr('for').split('-')[1]);
            const friendId = parseInt($(e.target).closest('label').attr('for').split('-')[3]);
            const input = parseFloat(e.target.value);
            this.items.get(itemId).setParticipant(friendId, input);
            this.calculate();
        }.bind(this));

        $('#total-amount-input').off('input').on('input', () => this.calculate());
        $('#subtotal-amount').off('input').on('input', () => this.calculate());
    }

    calculate() {
        $('#results-alert').html('');
        if (parseFloat($('#subtotal-amount').html()) <= 0 && ($('#total-amount-input').val() > 0 || $('#total-amount-additional').val() > 0)) {
            $('#results-alert').append(`[Error] Adding items to calculate.`);
        }

        let results = new Map(
            Array.from(this.friends, ([key, obj]) => [
                key,
                {
                    total: 0,
                    items: new Map(),    //  item.id, percentage of the friend in the item
                }
            ])
        );

        const calculatePercentage = (index, item, id, results) => {
            const totalPercentage = item.getTotalPercentage();
            if (totalPercentage > 100) {
                $('#results-alert').append(`[Error] Item #${index} exceed a total of 100%.<br>`);
                return;
            }
            const remainPercentage = 100 - item.getTotalPercentage();
            const countNaN = item.getNumNaNParticipant();
            if (!item.amount) {
                if (countNaN < item.participants.size) {
                    $('#results-alert').append(`[Error] "Amount" of item #${index} is empty.<br>`);
                }
                return;
            }
            if (remainPercentage && !countNaN) {
                $('#results-alert').append(`[Error] Item #${index} do not sum to 100%.<br>`);
                return;
            }
            item.participants.forEach((_, fid) => {
                if (item.getParticipantChecked(fid)) {
                    const percentage = (value => isNaN(value) ? remainPercentage/countNaN : value)(item.getParticipantPercentage(fid));
                    const itemfriendInput = $(`label[for="item-${item.id}-friend-${fid}"]`).find('input');
                    itemfriendInput.attr('placeholder', formatPercentHint(percentage));

                    const friendResult = results.get(fid);
                    friendResult.total += item.amount * percentage / 100;
                    friendResult.items.set(item.id, percentage / 100);
                }
            });
        };

        const calculateShare = (index, item, id, results) => {
            const totalShare = item.getTotalPercentage();
            if (totalShare <= 0) {
                $('#results-alert').append(`[Error] Item #${index} is completely empty.<br>`);
                return;
            }
            item.participants.forEach((_, fid) => {
                if (item.getParticipantChecked(fid)) {
                    const share = item.getParticipantPercentage(fid) || 0;
                    const itemfriendInput = $(`label[for="item-${item.id}-friend-${fid}"]`).find('input');
                    itemfriendInput.attr('placeholder', 0);

                    const percentage = share / totalShare;
                    const friendResult = results.get(fid);
                    friendResult.total += item.amount * percentage;
                    friendResult.items.set(item.id, percentage);
                }
            });

        }

        let index = 0;
        this.items.forEach((item, iid) => {
            ++index;
            // if (!item.amount) return;
            if (item.getUnitType() == ItemType.kTypePercent) {
                calculatePercentage(index, item, iid, results);
            } else {
                calculateShare(index, item, iid, results);
            }

        });

        const amountOfItems = Array.from(this.items.values()).map(item => item.amount);
        const originalAmount =  amountOfItems.reduce((accumulator, currentValue) => {
            return !isNaN(currentValue) ? accumulator + currentValue : accumulator;
        }, 0);
        const additionalAmount = parseFloat($('#total-amount-additional').val() || 0) / 100;
        const totalAmount = (value => isNaN(value) ? (originalAmount * (1 + additionalAmount)) : value)(parseFloat($('#total-amount-input').val()));

        this.showResult(originalAmount, totalAmount, results);
        const transfers = this.calculateSettlement(totalAmount, results);
        this.showSettlement(transfers);
        this.scheduleBillSave();
        return [originalAmount, totalAmount, results, transfers];
    }

    showResult(originalAmount, totalAmount, results) {
        const ratio = originalAmount > 0 ? (totalAmount / originalAmount) : 1;
        $('#total-amount').html(formatMoney(totalAmount));
        $('#total-amount-input').attr('placeholder', formatMoney(totalAmount));

        $('#subtotal-amount').html(formatMoney(originalAmount));
        $('#total-amount-additional').attr('placeholder', originalAmount > 0 ? ((totalAmount/originalAmount - 1) * 100).toFixed(1) : '0.0');

        const resultTotal = Array.from(results.values()).reduce((accumulator, currentValue) => accumulator + currentValue.total, 0);

        const resultsOutput = $('#results-output');
        resultsOutput.html('');
        this.friends.forEach((friend, fid) => {
            const owedPercent = resultTotal > 0 ? results.get(fid).total / resultTotal : 0;
            const totalAmountOwed = totalAmount * owedPercent;
            resultsOutput.append(`
                <div class="result-output-friend-container" id="result-output-friend-${fid}-container">
                    <div class="result-capsule">
                        <div class="result-avatar" style="background-color:${friend.rgbString};">
                            ${this.getFriendInitials(friend)}
                        </div>
                        <div class="result-info">
                            <span class="result-name">${friend.name}</span>
                            <span class="result-amount">${formatMoney(isNaN(totalAmountOwed) ? 0 : totalAmountOwed)}</span>
                        </div>
                    </div>

                    ${
                        (isNaN(totalAmountOwed) || totalAmountOwed == 0) ?
                            '' :
                            `<span class="result-output-detail" style="background-color:${friend.rgbString}">
                                <div class="container-flex-space result-output-detail-topic">
                                    <h5 style="color:rgb(255, 254, 251); display: inline;">
                                        <small>${friend.name}'s Summary <span style="font-weight:300; font-size:10px; opacity:0.85;">(${isNaN(owedPercent) ? 0 : (owedPercent*100).toFixed(2)}%)</span></small>
                                    </h5>
                                    <i class="fa-regular fa-clipboard" id="copy-btn-${fid}"></i>
                                </div>
                                ${
                                    Array.from(results.get(fid).items.entries()).map(([itemID, percentage]) => {
                                        const item = this.items.get(itemID);
                                        if (item) {
                                            const itemName = (item.name === null || item.name === undefined || item.name.trim() === '') ? '&lt;Unnamed&gt;' : item.name;
                                            const itemAmount = (item.amount * percentage) * ratio;
                                            return `<div class="result-output-friend-item container-flex-space">
                                                    <span class="item-head-name">${itemName}</span>
                                                    <span class="item-head-amount">${formatMoney(itemAmount)}</span>
                                                </div>`
                                        }
                                        return '';
                                    }).join('')
                                }
                            </span>`
                    }
                </div>
            `);

            $(`#result-output-friend-${fid}-container`).on('click', function(e) {
                const $detail = $(this).find('.result-output-detail');
                $detail.toggle();
            });
            $(`#result-output-friend-${fid}-container`).hover(
                function(e) { /* mouseenter */
                    if (!isTouchDevice()) {
                        const $detail = $(this).find('.result-output-detail');
                        if ($detail.is(':hidden')) {
                            $detail.toggle();
                        }
                    }
                },
                function(e) { /* mouseleave */
                    const $detail = $(this).find('.result-output-detail');
                    if (!$detail.is(':hidden')) {
                        $detail.toggle();
                    }
                }
            );
            $(`#copy-btn-${fid}`).closest('.result-output-detail-topic').on('click', (e) => {
                e.stopPropagation();
                const $copyBtn = $(`#copy-btn-${fid}`);
                const textCopy = `${friend.name}'s Item Summary:\n\n${
                    Array.from(results.get(fid).items.entries()).map(([itemID, percentage]) => {
                        const item = this.items.get(itemID);
                        if (item) {
                            const itemName = (item.name === null || item.name === undefined || item.name.trim() === '') ? '<Unnamed>' : item.name;
                            const itemAmount = (item.amount * percentage) * ratio;
                            return `📦 ${itemName} ${formatMoney(itemAmount)}\n`
                        }
                        return '';
                    }).join('')
                }\n🧮 Total: ${formatMoney(isNaN(totalAmountOwed) ? 0 : totalAmountOwed)} (${isNaN(owedPercent) ? 0 : (owedPercent*100).toFixed(4)}%)`;

                navigator.clipboard.writeText(textCopy)
                    .then(() => {
                        console.log('Text copied to clipboard:', textCopy);
                        $copyBtn.attr('class', 'fa-solid fa-check');
                        setTimeout(() => {
                            $copyBtn.attr('class', 'fa-regular fa-clipboard');
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy text: ', err);
                        showAppAlert('Copy Failed', 'Select the summary and copy it manually.');
                    });
            });
        });
    }

    getShareResults() {
        const [_, totalAmount, results, transfers] = this.calculate();
        const resultTotal = Array.from(results.values()).reduce((accumulator, currentValue) => accumulator + currentValue.total, 0);

        let resStr = `💵 Total is ${formatMoney(totalAmount)} 💵\n`;
        this.friends.forEach((friend, fid) => {
            const owedPercent = results.get(fid).total / resultTotal;
            const totalAmountOwed = totalAmount * owedPercent;
            resStr = resStr.concat(`👉 ${friend.name}:\n  ${formatMoney(isNaN(totalAmountOwed) ? 0 : totalAmountOwed)}\t(${isNaN(owedPercent) ? 0 : (owedPercent*100).toFixed(4)}%)\n`);
        });

        if ($('#settlement-section').hasClass('show') && transfers && transfers.length > 0) {
            resStr += `\n💸 Settlement 💸\n`;
            transfers.forEach(t => {
                resStr += `${t.from} → ${t.to}  ${formatMoney(t.amount)}\n`;
            });
        }

        return resStr;
    }

    autoDistribute(itemId) {
        let item = this.items.get(itemId);
        const remainPercentage = 100 - item.getTotalPercentage();
        const countNaN = Array.from(item.participants.values())
                            .map(p => p.percentage)
                            .reduce((accumulator, currentValue) => accumulator + (isNaN(currentValue) ? 1 : 0), 0);

        item.participants.forEach((_, id) => {
            if (item.getParticipantChecked(id) && isNaN(item.getParticipantPercentage(id))) {
                item.setParticipant(id, remainPercentage/countNaN);
            }
        });
        this.updateItemFriends();
    }

    switchUnit(itemId) {
        this.items.get(itemId).switchUnitType();
        this.updateItemsList();
    }

    bindAmountEvents() {
        $('#total-amount-additional').off('focus').on('focus', (e) => {
            $(e.target).val('');
            this.calculate();
        });
        $('#subtotal-amount').off('focus').on('focus', (e) => {
            $(e.target).val('');
            this.calculate();
        });

        $('#total-amount-additional').off('input').on('input', () => this.calculate());
        $('#subtotal-amount').off('input').on('input', () => this.calculate());
        $('#detail-amount-container').off('hide.bs.collapse').on('hide.bs.collapse', (e) => {
            $('.total-amount-container .collapse-btn .fa-angle-down').hide();
            $('.total-amount-container .collapse-btn .fa-angle-right').show();
        });
        $('#detail-amount-container').off('show.bs.collapse').on('show.bs.collapse', (e) => {
            $('.total-amount-container .collapse-btn .fa-angle-down').show();
            $('.total-amount-container .collapse-btn .fa-angle-right').hide();
        });
        $('.total-amount-container .summary-toggle-header').off('click').on('click', (e) => {
            if ($(e.target).closest('.collapse-btn').length) {
                return;
            }
            $(e.currentTarget).find('.collapse-btn').trigger('click');
        });
    }

    attachEventListeners() {
        $('#add-friend').on('click', () => {
            this.addFriend(`Friend${Friend.nextId}`);
        });

        $('#add-item').on('click', () => {
            this.addItem();
            $('#items-list').show();
        });

        $('#manual-entry-btn').on('click', () => {
            document.getElementById('bill-section').scrollIntoView({ behavior: 'smooth' });
        });

        $('#app-info-btn').on('click', async () => {
        $('#app-info-btn').attr('aria-expanded', 'true');
            await showAppAlert(
                'Shareceipt',
                'Split receipt items, handle fees, and settle up with friends.\nPrepare your Gemini key, then upload a receipt to get started.'
            );
            $('#app-info-btn').attr('aria-expanded', 'false').trigger('focus');
        });

        let settlementScrollFrame = null;
        const scrollToPageBottom = () => {
            const scrollRoot = document.scrollingElement || document.documentElement;
            window.scrollTo(0, scrollRoot.scrollHeight);
        };
        const isNearPageBottom = () => {
            const scrollRoot = document.scrollingElement || document.documentElement;
            return window.scrollY + window.innerHeight >= scrollRoot.scrollHeight - 120;
        };
        $('#settlement-section').off('show.bs.collapse').on('show.bs.collapse', () => {
            if (!isNearPageBottom()) return;

            const startTime = performance.now();
            const keepBottomAnchored = () => {
                scrollToPageBottom();
                if (performance.now() - startTime < 400) {
                    settlementScrollFrame = requestAnimationFrame(keepBottomAnchored);
                }
            };
            settlementScrollFrame = requestAnimationFrame(keepBottomAnchored);
        });
        $('#settlement-section').off('shown.bs.collapse').on('shown.bs.collapse', () => {
            if (settlementScrollFrame) {
                cancelAnimationFrame(settlementScrollFrame);
                settlementScrollFrame = null;
            }
            scrollToPageBottom();
            this.scheduleBillSave();
        });
        $('#settlement-section').off('hidden.bs.collapse').on('hidden.bs.collapse', () => {
            this.scheduleBillSave();
        });

        window.addEventListener('pagehide', () => this.saveBillNow());
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'hidden') {
                this.saveBillNow();
            }
        });

        $('#share-result-btn').on('click', async () => {
            try {
                const res = this.getShareResults();
                const shareData = {
                    title: 'Share the results!',
                    text: `🍣 Each Person's Share 🌮\n${res}`,
                    url: document.location.href
                };
                await navigator.share(shareData)
            } catch(err) {
                console.log( 'Error: ' + err );
            }
        });

        this.bindAmountEvents();

        $('#receipt-upload-btn').on('click', async () => {
            const key = localStorage.getItem(API_KEY_STORAGE_KEY);
            if (key === null || key === '') {
                if (!await this.setGeminiKey()) {
                    return;
                }
            }
            $('#receipt-upload-input').click();
        });
        $('.new-split-bill-hero').on('click', () => {
            $('#receipt-upload-btn').trigger('click');
        });
        $('#receipt-upload-input').on('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.pendingReceiptPreviewFile = file;
                this.analyzeReceipt(file);
            }
            $(event.target).val(null);
        });
        $('#update-api-key-btn').on('click', () => {
            openKeyModal();
        });
    }

    updateSettlementFriends() {
        const savedValues = new Map();
        const savedChecked = new Map();
        $('.settlement-paid').each((_, el) => {
            const fid = parseInt($(el).data('fid'));
            const val = $(el).val();
            if (val !== '') savedValues.set(fid, val);
            const checkbox = $(el).closest('.settlement-paid-row').find('input[type="checkbox"]');
            if (checkbox.length) savedChecked.set(fid, checkbox[0].checked);
        });

        const container = $('#settlement-paid-inputs');
        container.empty();
        this.friends.forEach((friend, fid) => {
            const saved = savedValues.get(fid);
            const isFirst = container.children().length === 0;
            const checked = savedChecked.has(fid) ? savedChecked.get(fid) : isFirst;
            container.append(`
                <div class="settlement-paid-row">
                    <input type="checkbox" id="settlement-check-${fid}" class="settlement-checkbox" data-fid="${fid}" ${checked ? 'checked' : ''}>
                    <label for="settlement-check-${fid}" class="settlement-paid-label">
                        <span class="result-avatar settlement-avatar" title="${this.escapeAttribute(friend.name)}" style="background-color:${friend.rgbString};">${this.getFriendInitials(friend)}</span>
                        <span class="settlement-paid-text">paid</span>
                    </label>
                    <div class="settlement-paid-input-wrapper">
                        <span class="currency-prefix">${getCurrencySymbol()}</span>
                        <input type="number" class="settlement-paid" data-fid="${fid}" min="0" step="0.01" ${!checked ? 'disabled placeholder="0"' : ''} ${saved !== undefined && checked ? `value="${saved}"` : ''}>
                    </div>
                </div>
            `);
        });
        $('.settlement-paid').off('input').on('input', () => this.calculate());
        $('.settlement-checkbox').off('change').on('change', (e) => {
            const fid = parseInt($(e.target).data('fid'));
            const checked = e.target.checked;
            const input = $(`.settlement-paid[data-fid="${fid}"]`);
            input[0].disabled = !checked;
            input.val('');
            input.attr('placeholder', checked ? '' : '0');
            if (checked) input.focus();
            this.calculate();
        });
        $('.settlement-paid-row').off('click', '.settlement-paid-input-wrapper').on('click', '.settlement-paid-input-wrapper', (e) => {
            const row = $(e.currentTarget).closest('.settlement-paid-row');
            const checkbox = row.find('.settlement-checkbox')[0];
            if (checkbox.checked) return;

            e.preventDefault();
            checkbox.checked = true;
            $(checkbox).trigger('change');
        });
    }

    calculateSettlement(totalAmount, results) {
        if (totalAmount === undefined) return [];
        const resultTotal = Array.from(results.values()).reduce((acc, v) => acc + v.total, 0);
        $('#settlement-alert').html('');

        const inputs = $('.settlement-paid');
        let totalFilled = 0;
        let emptyCount = 0;
        inputs.each((_, el) => {
            const checkbox = $(el).closest('.settlement-paid-row').find('.settlement-checkbox')[0];
            if (!checkbox.checked) return;
            const val = parseFloat($(el).val());
            if (!isNaN(val)) {
                totalFilled += val;
            } else {
                emptyCount++;
            }
        });
        const remain = totalAmount - totalFilled;
        if (remain < 0) {
            $('#settlement-alert').html(`[Error] The total paid amount exceed the total amount by ${formatMoney(-remain)}.`);
        } else if (remain > 0 && emptyCount === 0) {
            $('#settlement-alert').html(`[Error] The total paid amount is less than the total amount by $${formatMoney(remain)}.`);
        }
        const placeholderVal = emptyCount > 0 ? Math.max(0, remain / emptyCount) : 0;
        inputs.each((_, el) => {
            const checkbox = $(el).closest('.settlement-paid-row').find('.settlement-checkbox')[0];
            if ($(el).val() === '' && checkbox.checked) {
                $(el).attr('placeholder', formatComputedHint(placeholderVal));
            }
        });
        const balances = [];
        this.friends.forEach((friend, fid) => {
            const owedPercent = resultTotal > 0 ? results.get(fid).total / resultTotal : 0;
            const share = totalAmount * owedPercent;
            const input = $(`.settlement-paid[data-fid="${fid}"]`);
            const checkbox = input.closest('.settlement-paid-row').find('.settlement-checkbox')[0];
            const paid = !checkbox.checked ? 0 : (input.val() !== '' ? parseFloat(input.val()) : placeholderVal);
            balances.push({
                fid,
                name: friend.name,
                initials: this.getFriendInitials(friend),
                rgb: friend.rgbString,
                balance: paid - share
            });
        });

        balances.sort((a, b) => a.balance - b.balance);

        const transfers = [];
        let i = 0, j = balances.length - 1;
        while (i < j) {
            const debtor = balances[i];
            const creditor = balances[j];
            if (isNaN(debtor.balance) || isNaN(creditor.balance)) break;
            const amount = Math.min(-debtor.balance, creditor.balance);
            if (amount > 0.01) {
                transfers.push({
                    from: debtor.name,
                    fromInitials: debtor.initials,
                    fromRgb: debtor.rgb,
                    to: creditor.name,
                    toInitials: creditor.initials,
                    toRgb: creditor.rgb,
                    amount
                });
            }
            debtor.balance += amount;
            creditor.balance -= amount;
            if (Math.abs(debtor.balance) < 0.01) i++;
            if (Math.abs(creditor.balance) < 0.01) j--;
        }
        return transfers;
    }

    showSettlement(transfers) {
        const output = $('#settlement-output');
        output.empty();
        if (!$('#settlement-alert').html()) {
            if (transfers.length === 0) {
                output.append('<div class="settlement-transfer">All settled!</div>');
            } else {
                transfers.forEach(t => {
                    output.append(`<div class="settlement-transfer">
                        <span class="settlement-transfer-content">
                            <span class="settlement-transfer-route">
                                <span class="result-avatar settlement-avatar" title="${this.escapeAttribute(t.from)}" style="background-color:${t.fromRgb};">${t.fromInitials}</span>
                                <span class="settlement-arrow">→</span>
                                <span class="result-avatar settlement-avatar" title="${this.escapeAttribute(t.to)}" style="background-color:${t.toRgb};">${t.toInitials}</span>
                            </span>
                            <span class="settlement-amount">${formatMoney(t.amount)}</span>
                        </span>
                    </div>`);
                });
            }
        }
    }

    async editName(id) {
        const friend = this.friends.get(id);

        if (!friend) {
            return;
        }

        const originalName = friend.name;

        await showAppEditor('Rename', {
            value: originalName,
            placeholder: 'Name',
            onInput: (value) => {
            friend.name = value.trim() === '' ? originalName : value.trim();
            this.updateFriendList();
            }
        });
    }

    async setGeminiKey() {
        await openKeyModal();

        return Boolean(localStorage.getItem(API_KEY_STORAGE_KEY));
    }

    showReceiptPreview(file) {
        if (this.receiptPreviewUrl) {
            URL.revokeObjectURL(this.receiptPreviewUrl);
        }

        this.receiptPreviewUrl = URL.createObjectURL(file);
        $('#receipt-preview-img').attr('src', this.receiptPreviewUrl);
        $('#receipt-preview-frame').removeClass('is-processing').addClass('has-preview');
    }

    analyzeReceipt(file) {
        const GOOGLE_API_KEY = localStorage.getItem('apiKey');

        const promptMsg = `The image contains a receipt. Please carefully analyze the details and list each valid item along with its amount.
        Here are some guidelines for identifying items:
        1. The receipt may contain rows and information that are not items or the total amount; be careful not to confuse them.
        2. If a row represents an item, the name will be on the left and the amount on the right, and both will be aligned on the same line. Be careful not to mistake the total amount for an item.
        3. If a row has a number on the right followed by "TX" (e.g., 10TX means that the amount is 10), it usually indicates that this row is an item.
        4. The total amount is typically found on the last line of the receipt, and any information following it will not be an item.
        5. You can try to understand the content of the receipt to identify which rows might be items, but when outputting, ensure the name matches exactly as it appears on the receipt.
        6. If all item amounts are integers (i.e., no decimal points), then the amounts on the receipt (including the total amount) will also be integers only.`;

        const responseSchema = {
            type: 'object',
            properties: {
                items: {
                type: 'array',
                items: {
                    type: 'object',
                    properties: {
                    name: { type: 'string', description: 'The item name exactly as printed on the receipt.' },
                    amount: { type: 'number', description: 'The item amount as a number.' }
                    },
                    required: ['name', 'amount']
                }
                },
                total: { type: 'number', description: 'The total amount printed on the receipt.' },
                currency: { type: 'string', description: 'ISO 4217 code for the currency on the receipt, e.g., USD, EUR, JPY, TWD. Empty string if it is cannot be determined.' },
                locale: { type: 'string', description: 'BCP 47 tag for where the receipt is from, e.g., ja-JP, de-DE, zh-TW. Used to format amounts the way that place writes them. Empty string if it cannot be determined.' }
            },
            required: ['items', 'total', 'currency', 'locale']
        };

        const model = getSelectedModel();
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const reader = new FileReader();
        reader.onload = (e) => {
            console.log('processing img...')
            const base64Data = e.target.result.split(',')[1];
            const requestData = {
                contents: [{
                    parts: [
                        { text: promptMsg },
                        { inline_data: { mime_type: file.type, data: base64Data } }
                    ]
                }],
                generationConfig: {
                    temperature: 0.1,
                    responseMimeType: 'application/json',
                    responseJsonSchema: responseSchema
                }
            };

            $('#receipt-preview-frame').removeClass('has-preview').addClass('is-processing');

            $.ajax({
                url: url,
                type: 'POST',
                contentType: 'application/json',
                headers: { 'x-goog-api-key': GOOGLE_API_KEY },
                data: JSON.stringify(requestData),
                success: (response) => {
                    let data;
                    const textContent = response.candidates[0].content.parts[0].text;
                    try {
                        const jsonData = JSON.parse(textContent);
                        if (Array.isArray(jsonData.items)) {
                            data = {
                                items: jsonData.items,
                                total: jsonData.total,
                                currency: jsonData.currency,
                                locale: jsonData.locale
                            };
                        }
                    } catch (e) {
                        console.error('JSON parsing error:', e);
                        showAppAlert('Could not read the reply', "The model's reply was not in the expected shape. Please try again.");
                        return;
                    }
                    console.log('Output:\n', data);
                    if (data) {
                        try {
                            setMoneyFormat(data.currency, data.locale);
                            $('#total-amount-input').val(parseFloat(data.total));
                            this.items = new Map();
                            $.each(data.items, (i, item) => {
                                this.addItem(item.name, item.amount)
                            });
                            this.items.forEach((_, iid) => {
                                $(`#item-collapse-btn-${iid}`).click()
                            });
                            if (this.pendingReceiptPreviewFile) {
                                this.showReceiptPreview(this.pendingReceiptPreviewFile);
                                this.pendingReceiptPreviewFile = null;
                            }
                            document.getElementById('bill-section').scrollIntoView({ behavior: 'smooth' });
                        } catch (e) {
                            console.error('JSON parsing error:', e);
                            showAppAlert('Could not read the reply', "The model's reply was not in the expected shape. Please try again.");
                        }
                    } else {
                        showAppAlert('No items found', "Nothing on this receipt could be read. Try a sharper photo.");
                    }
                },
                error: (xhr, status, error) => {
                    let errorMessage = 'An unknown error occurred.';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMessage = xhr.responseJSON.error.message;
                        console.error('Error message:', errorMessage);
                    }
                    showAppAlert('Scan failed', errorMessage);
                    if (errorMessage.toLowerCase().includes('key') && errorMessage.toLowerCase().includes('valid')) {
                        writeApiKey('');
                    }
                },
                complete: () => {
                    $('#receipt-preview-frame').removeClass('is-processing');
                    $('#receipt-upload-input').val();
                }
            });

        }
        reader.readAsDataURL(file);
    };

    applyHandoffOrder(order) {
        const items = Array.isArray(order.items) ? order.items : [];

        if (items.length === 0) {
            return false;
        }

        setMoneyFormat(order.currency, order.locale);

        this.items = new Map();
        items.forEach((item) => {
            const name = item.translatedName || item.originalName || '';
            const quantity = Number(item.quantity) > 0 ? Number(item.quantity) : 1;
            const label = quantity > 1 ? `${name} x${quantity}` : name;
            const amount = item.unitAmount === null || item.unitAmount === undefined
                ? undefined
                : Number(item.unitAmount) * quantity;

            this.addItem(label, amount);
        });

        this.items.forEach((_, iid) => {
            $(`#item-collapse-btn-${iid}`).click();
        });

        document.getElementById('bill-section').scrollIntoView({ behavior: 'smooth' });
        return true;
    }

}


const hashParams = new URLSearchParams(window.location.hash.slice(1));
const urlKey = hashParams.get('key');
if (urlKey) {
    localStorage.setItem('apiKey', urlKey);
    history.replaceState(null, '', window.location.pathname);
}

attachAppModalEvents();
attachKeyModalEvents();
refreshKeyChip();

const friendManager = new FriendManager();

(function listenForMenualHandoff() {
  if (!window.opener) {
    return;
  }

  window.addEventListener('message', (event) => {
    const data = event.data;

    if (!data || data.type !== 'menual:order' || !Array.isArray(data.items)) {
      return;
    }

    const handoffKey = String(data.apiKey || '').trim();
    if (handoffKey) {
      writeApiKey(handoffKey);
    }

    if (friendManager.applyHandoffOrder(data)) {
      event.source?.postMessage({ type: 'menual:ack' }, event.origin);
    }
  });

  window.opener.postMessage({ type: 'menual:ready' }, '*');
})();