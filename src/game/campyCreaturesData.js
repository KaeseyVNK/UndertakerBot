const CREATURES = [
    {
        name: 'The Blob',
        strength: 0,
        ability: 'Lá Quái vật bạn loại bỏ khỏi tay sẽ bị The Blob hấp thụ, chỉ cộng thêm Sức mạnh của lá đó chứ không phải Khả năng.',
        activationPhase: 'reveal',
    },
    {
        name: 'The Swamp Creature',
        strength: 1,
        ability: 'Bạn phải đưa lá Mortal bạn bắt được cho một người chơi khác.',
        activationPhase: 'capture',
    },
    {
        name: 'The Invisible Man',
        strength: 2,
        ability: 'Bạn có thể loại bỏ một trong những lá Mortal đã bắt được của mình (bao gồm cả lá vừa bắt được bằng The Invisible Man).',
        activationPhase: 'capture',
    },
    {
        name: 'The Demogorgon',
        strength: 2,
        ability: 'Mortal bắt được phải được trả về dưới cùng của chồng bài Mortal. Người chơi sau đó nhìn lá trên cùng và bắt úp nó xuống.',
        activationPhase: 'capture',
    },
    {
        name: 'The Mummy',
        strength: 3,
        ability: 'The Mummy sẽ bắt Mortal ngay lập tức trước tất cả các quái vật khác nếu có Kaiju đang trong cuộc. The Mummy không bắt lần thứ hai nếu đã bắt rồi.',
        activationPhase: 'reveal',
    },
    {
        name: 'The Invader',
        strength: 4,
        ability: 'Nếu có hai hoặc nhiều Mortal, bạn phải bắt hai. Nếu chỉ có một, chỉ bắt một.',
        activationPhase: 'capture',
    },
    {
        name: 'The Werewolf',
        strength: 5,
        ability: 'Người chơi bên phải bạn phải chọn và loại bỏ một lá Quái vật từ trên tay của họ (ngửa mặt lên).',
        activationPhase: 'capture',
    },
    {
        name: 'The Vampire',
        strength: 6,
        ability: 'Khả năng của Quái vật của người chơi bên trái bạn bị vô hiệu hóa, nhưng Sức mạnh của nó vẫn được giữ nguyên.',
        activationPhase: 'reveal',
    },
    {
        name: 'The Beast',
        strength: 7,
        ability: 'Nếu bạn vẫn còn The Beast trên tay vào cuối vòng, cộng thêm 3 Điểm vào tổng điểm của bạn.',
        activationPhase: 'passive',
    },
    {
        name: 'The Kaiju',
        strength: 8,
        ability: 'Vua của các loài Quái vật không cần khả năng đặc biệt.',
        activationPhase: 'passive',
    },
];

const MORTAL_SETS = {
    CLASSICS: [
        { name: 'The Cursed Totem', points: -3, type: 'classic', locationIcon: 0 },
        { name: 'The Haunted Doll', points: -2, type: 'classic', locationIcon: 0 },
        { name: 'The Tourist', points: 0, type: 'classic', locationIcon: 0 },
        { name: 'The Hitchhiker', points: 0, type: 'classic', locationIcon: 1 },
        { name: 'The Jock', points: 1, type: 'classic', locationIcon: 0 },
        { name: 'The Captain', points: 1, type: 'classic', locationIcon: 0 },
        { name: 'The Nerd', points: 2, type: 'classic', locationIcon: 1 },
        { name: 'The Old Man', points: 2, type: 'classic', locationIcon: 0 },
        { name: 'The Preacher', points: 3, type: 'classic', locationIcon: 0 },
        { name: 'The Scientist', points: 4, type: 'classic', locationIcon: 1 },
        { name: 'The Damsel', points: 5, type: 'classic', locationIcon: 0 },
        { name: 'The Mayor', points: 6, type: 'classic', locationIcon: 1 },
    ],
    TEENAGERS: [
        { name: 'One Teenager', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'One Teenager', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'One Teenager', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'One Teenager', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'One Teenager', points: 0, type: 'teenager', locationIcon: 1 },
        { name: 'Two Teenagers', points: 0, type: 'teenager', locationIcon: 1 },
        { name: 'Two Teenagers', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'Two Teenagers', points: 0, type: 'teenager', locationIcon: 0 },
        { name: 'Two Teenagers', points: 0, type: 'teenager', locationIcon: 1 },
        { name: 'Three Teenagers', points: 0, type: 'teenager', locationIcon: 1 },
        { name: 'Three Teenagers', points: 0, type: 'teenager', locationIcon: 1 },
    ],
    ENGINEERS: Array(11).fill(null).map((_, i) => ({
        name: 'Engineer',
        points: 0,
        type: 'engineer',
        locationIcon: i < 4 ? 1 : 0,
    })),
    ASSISTANTS: Array(10).fill(null).map(() => ({
        name: 'Assistant',
        points: 0,
        type: 'assistant',
        locationIcon: 0,
    })),
};

const LOCATIONS = {
    REWARDS: [
        {
            name: 'Camp Murkwood',
            description: 'Người chinh phục nhận thêm 2 lá Teenagers trước khi tính điểm. (Chỉ dùng khi có bộ Teenagers).',
            type: 'reward',
            oneTimeUse: false,
            requiresSet: 'TEENAGERS',
        },
        {
            name: 'The Graveyard',
            description: 'Bỏ lá này để hồi sinh một Quái vật ngẫu nhiên từ chồng bài bỏ về tay bạn.',
            type: 'reward',
            oneTimeUse: true,
        },
        {
            name: 'Lunar Base LZ-R',
            description: 'Bỏ lá này trước khi lật bài để giảm 2 Sức mạnh của một người chơi. Người đó được chọn lại bài.',
            type: 'reward',
            oneTimeUse: true,
        },
        {
            name: 'The Metropolis',
            description: 'Nhận 2 điểm và ngay lập tức leo lên đầu thang Clash-O-Meter.',
            type: 'reward',
            oneTimeUse: false,
        },
        {
            name: 'The Mystic Portal',
            description: 'Bỏ lá này để đổi một Mortal bạn đã bắt với một Mortal trong chồng bài bỏ chung.',
            type: 'reward',
            oneTimeUse: true,
        },
        {
            name: 'The Secret Lab',
            description: 'Lá này được coi như một lá Assistant vĩnh viễn.',
            type: 'reward',
            oneTimeUse: false,
        },
    ],
    FINAL_ACTS: [
        {
            name: 'The Ancient Temple',
            description: 'Gấp đôi điểm của tất cả Mortals có điểm dương bạn bắt được trong ván này.',
            type: 'final_act',
        },
        {
            name: 'The Parallel World',
            description: 'Mọi Mortal có điểm âm sẽ được tính thành điểm dương. Engineer lẻ giờ được +2 điểm.',
            type: 'final_act',
        },
        {
            name: 'The Uncharted Island',
            description: 'Ghi điểm dựa trên lá Quái vật mạnh nhất còn lại trên tay vào cuối game.',
            type: 'final_act',
        },
    ]
};

module.exports = {
    CREATURES,
    MORTAL_SETS,
    LOCATIONS,
}; 