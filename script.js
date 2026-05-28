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

class FriendManager {
    constructor() {
        this.friends = new Map();
        this.items = new Map();
        this.friendListElement = $('#friends-list');
        this.itemsListElement = $('#items-list');
        this.initializeFriends();
        this.initializeItems();
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
                        <div class="item-header-row item-collapsed-row" style="display:none;">
                            <button class="collapse-btn collapse-green-btn collapsed-toggle-btn" data-bs-toggle="collapse" data-bs-target="#item-container-${item.id}" aria-expanded="false">
                                <i class="fa-solid fa-caret-down"></i>
                            </button>
                            <span class="item-collapsed-name">${item.name || 'Untitled'}</span>
                            <span class="item-collapsed-price">${item.amount ? '$' + parseFloat(item.amount).toFixed(2) : ''}</span>
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
                $collRow.find('.item-collapsed-price').text(item.amount ? '$' + parseFloat(item.amount).toFixed(2) : '');
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
    }

    bindItemEvents() {
        $('#items-list .item .delete-btn').off('click').on('click', (e) => {
            const itemId = parseInt($(e.target).closest('.item').data('id'));
            this.removeItem(itemId);
        });

        // When collapse hides (item collapses): show collapsed row, hide expanded row
        $('#items-list .item .item-container').off('hide.bs.collapse').on('hide.bs.collapse', (e) => {
            const itemdiv = $(e.target).closest('.item');
            const name = itemdiv.find('.item-name').val() || 'Untitled';
            const amount = itemdiv.find('.item-amount').val();

            // Update collapsed row text
            itemdiv.find('.item-collapsed-name').text(name);
            itemdiv.find('.item-collapsed-price').text(amount ? '$' + parseFloat(amount).toFixed(2) : '');

            // Swap rows
            itemdiv.find('.item-expanded-row').hide();
            itemdiv.find('.item-collapsed-row').show();
        });

        // When collapse shows (item expands): show expanded row, hide collapsed row
        $('#items-list .item .item-container').off('show.bs.collapse').on('show.bs.collapse', (e) => {
            const itemdiv = $(e.target).closest('.item');
            itemdiv.find('.item-collapsed-row').hide();
            itemdiv.find('.item-expanded-row').show();
        });

        $('#items-list .item .item-collapsed-row').off('click').on('click', (e) => {
            if ($(e.target).closest('.collapse-btn, .delete-btn').length) {
                return;
            }
            $(e.currentTarget).find('.collapsed-toggle-btn').trigger('click');
        });

        $('#items-list .item .distribute-btn').off('click').on('click', (e) => {
            const itemId = parseInt($(e.target).closest('.item').data('id'));
            this.autoDistribute(itemId);
        });

        $('#items-list .item .unit-btn').off('click').on('click', (e) => {
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
                const priceStr = e.target.value ? '$' + parseFloat(e.target.value).toFixed(2) : '';
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
                    itemfriendInput.attr('placeholder', percentage);

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
        return [originalAmount, totalAmount, results, transfers];
    }

    showResult(originalAmount, totalAmount, results) {
        const ratio = originalAmount > 0 ? (totalAmount / originalAmount) : 1;
        $('#total-amount').html(totalAmount.toFixed(2));
        $('#total-amount-input').attr('placeholder', totalAmount.toFixed(2));

        $('#subtotal-amount').html(originalAmount.toFixed(2));
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
                            <span class="result-amount">$${isNaN(totalAmountOwed) ? 0 : totalAmountOwed.toFixed(2)}</span>
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
                                                    <span class="item-head-amount">$${itemAmount.toFixed(2)}</span>
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
            $(`#copy-btn-${fid}`).on('click', (e) => {
                e.stopPropagation();
                const $copyBtn = $(`#copy-btn-${fid}`);
                // const $detail = $copyBtn.closest('.result-output-friend');
                // const textCopy = $detail.text().trim();
                const textCopy = `${friend.name}'s Item Summary:\n\n${
                    Array.from(results.get(fid).items.entries()).map(([itemID, percentage]) => {
                        const item = this.items.get(itemID);
                        if (item) {
                            const itemName = (item.name === null || item.name === undefined || item.name.trim() === '') ? '<Unnamed>' : item.name;
                            const itemAmount = (item.amount * percentage) * ratio;
                            return `📦 ${itemName} $${itemAmount.toFixed(2)}\n`
                        }
                        return '';
                    }).join('')
                }\n🧮 Total: ${isNaN(totalAmountOwed) ? 0 : totalAmountOwed.toFixed(2)} (${isNaN(owedPercent) ? 0 : (owedPercent*100).toFixed(4)}%)`;

                navigator.clipboard.writeText(textCopy)
                    .then(() => {
                        console.log('Text copied to clipboard:', textCopy);
                        $copyBtn.removeClass('fa-regular fa-clipboard').addClass('fa-solid fa-check');
                        setTimeout(() => {
                            $copyBtn.removeClass('fa-solid fa-check').addClass('fa-regular fa-clipboard');
                        }, 1500);
                    })
                    .catch(err => {
                        console.error('Failed to copy text: ', err);
                        alert('Failed to copy. Please copy manually.');
                    });
            });
        });
    }

    getShareResults() {
        const [_, totalAmount, results, transfers] = this.calculate();
        const resultTotal = Array.from(results.values()).reduce((accumulator, currentValue) => accumulator + currentValue.total, 0);

        let resStr = `💵 Total is $${(totalAmount).toFixed(2)} 💵\n`;
        this.friends.forEach((friend, fid) => {
            const owedPercent = results.get(fid).total / resultTotal;
            const totalAmountOwed = totalAmount * owedPercent;
            resStr = resStr.concat(`👉 ${friend.name}:\n  $${isNaN(totalAmountOwed) ? 0 : totalAmountOwed.toFixed(2)}\t(${isNaN(owedPercent) ? 0 : (owedPercent*100).toFixed(4)}%)\n`);
        });

        if ($('#settlement-section').hasClass('show') && transfers && transfers.length > 0) {
            resStr += `\n💸 Settlement 💸\n`;
            transfers.forEach(t => {
                resStr += `${t.from} → ${t.to}  $${t.amount.toFixed(2)}\n`;
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

        $('#receipt-upload-btn').on('click', () => {
            const key = localStorage.getItem('apiKey')
            if (key === null || key === '') {
                if (!this.setGeminiKey()) {
                    window.alert('Provide API key to use this feature.')
                    return;
                }
            }
            $('#receipt-upload-input').click();
        });
        $('#receipt-upload-input').on('change', (event) => {
            const file = event.target.files[0];
            if (file) {
                this.analyzeReceipt(file);
            }
            $(event.target).val(null);
        });
        $('#update-api-key-btn').on('click', () => {
            this.setGeminiKey();
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
                        <span class="currency-prefix">$</span>
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
            $('#settlement-alert').html(`[Error] The total paid amount exceed the total amount by $${(-remain).toFixed(2)}.`);
        } else if (remain > 0 && emptyCount === 0) {
            $('#settlement-alert').html(`[Error] The total paid amount is less than the total amount by $${remain.toFixed(2)}.`);
        }
        const placeholderVal = emptyCount > 0 ? Math.max(0, remain / emptyCount) : 0;
        inputs.each((_, el) => {
            const checkbox = $(el).closest('.settlement-paid-row').find('.settlement-checkbox')[0];
            if ($(el).val() === '' && checkbox.checked) {
                $(el).attr('placeholder', placeholderVal.toFixed(2));
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
                        <span class="result-avatar settlement-avatar" title="${this.escapeAttribute(t.from)}" style="background-color:${t.fromRgb};">${t.fromInitials}</span>
                        <span class="settlement-arrow">→</span>
                        <span class="result-avatar settlement-avatar" title="${this.escapeAttribute(t.to)}" style="background-color:${t.toRgb};">${t.toInitials}</span>
                        <span class="settlement-amount">$${t.amount.toFixed(2)}</span>
                    </div>`);
                });
            }
        }
    }

    editName(id) {
        const friend = this.friends.get(id);
        if (friend) {
            const newName = prompt('Rename:', friend.name);
            if (newName !== null && newName.trim() !== '') {
                friend.name = newName.trim();
                this.updateFriendList();
            } else if (newName.trim() === '') {
                alert('Friend name cannot be empty or contain only spaces.');
            }
        }
    }

    setGeminiKey() {
        const userInput = prompt("Please type in your Gemini API key", localStorage.getItem('apiKey') || '');
        if (userInput) {
            localStorage.setItem('apiKey', userInput);
            return true;
        } else {
            return false;
        }
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
        6. If all item amounts are integers (i.e., no decimal points), then the amounts on the receipt (including the total amount) will also be integers only.
        Finally, ensure that the results are returned in a valid JSON format:
        {
            "items": [
                {"name": "item name", "amount": 00.00},
                ...
            ],
            "total": 00.00
        }`;

        const model = 'gemini-flash-latest';
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GOOGLE_API_KEY}`;

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
                }]
            };

            $('#receipt-upload-btn .fa-camera, #receipt-upload-btn .fa-arrow-up-from-bracket').hide();
            $('#receipt-upload-btn .fa-spinner').show();

            $.ajax({
                url: url,
                type: 'POST',
                contentType: 'application/json',
                data: JSON.stringify(requestData),
                success: (response) => {
                    let data;
                    const textContent = response.candidates[0].content.parts[0].text;
                    const regex = /```json\s*([\s\S]*?)\s*```/;
                    const jsonMatch = textContent.match(regex);
                    if (jsonMatch && jsonMatch[1]) {
                        try {
                            const jsonData = JSON.parse(jsonMatch[1]);
                            data = {
                                items: jsonData.items,
                                total: jsonData.total
                            };
                        } catch (e) {
                            console.error('JSON parsing error:', e);
                            window.alert("[Error] There was an error processing the model's reply. Please try again.");
                            return;
                        }
                    }
                    console.log('Output:\n', data);
                    if (data) {
                        try {
                            $('#total-amount-input').val(parseFloat(data.total).toFixed(2));
                            this.items = new Map();
                            $.each(data.items, (i, item) => {
                                this.addItem(item.name, item.amount)
                            });
                            this.items.forEach((_, iid) => {
                                $(`#item-collapse-btn-${iid}`).click()
                            });
                        } catch (e) {
                            console.error('JSON parsing error:', e);
                            window.alert("[Error] There was an error processing the model's reply. Please try again.");
                        }
                    } else {
                        window.alert('[Error] No items on the receipt were found. Please try again.');
                    }
                },
                error: (xhr, status, error) => {
                    let errorMessage = 'An unknown error occurred.';
                    if (xhr.responseJSON && xhr.responseJSON.error) {
                        errorMessage = xhr.responseJSON.error.message;
                        console.error('Error message:', errorMessage);
                    }
                    window.alert(`[Error] ${errorMessage}`);
                    if (errorMessage.toLowerCase().includes('key') && errorMessage.toLowerCase().includes('valid')) {
                        localStorage.setItem('apiKey', '');
                    }
                },
                complete: () => {
                    $('#receipt-upload-btn .fa-spinner').hide();
                    $('#receipt-upload-btn .fa-camera, #receipt-upload-btn .fa-arrow-up-from-bracket').show();
                    $('#receipt-upload-input').val();
                }
            });

        }
        reader.readAsDataURL(file);
    };

}


const hashParams = new URLSearchParams(window.location.hash.slice(1));
const urlKey = hashParams.get('key');
if (urlKey) {
    localStorage.setItem('apiKey', urlKey);
    history.replaceState(null, '', window.location.pathname);
}

const friendManager = new FriendManager();
