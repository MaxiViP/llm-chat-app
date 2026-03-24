// // Лимит-трекер для всех провайдеров
// export class LimitTracker {
//   private usage: Record<string, number> = {};
//   private limits: Record<string, number> = {};
  
//   constructor() {
//     // Инициализация лимитов (загружается из конфига)
//     this.loadLimits();
//   }
  
//   async loadLimits(): Promise<void> {
//     try {
//       const limits = await fetchLimits(); // Загрузка лимитов из конфига
//       this.limits = limits;
      
//       // Загрузка текущего использования
//       const usage = await fetchUsage();
//       this.usage = usage;
//     } catch (error) {
//       console.error('Ошибка загрузки лимитов:', error);
//     }
//   }
  
//   // Регистрация нового провайдера
//   registerProvider(providerId: string, limit: number): void {
//     if (!this.limits[providerId]) {
//       this.limits[providerId] = limit;
//       this.saveLimits();
//     }
//   }
  
//   // Запись использования
//   recordUsage(providerId: string, bytes: number): void {
//     if (this.usage[providerId] === undefined) {
//       this.usage[providerId] = 0;
//     }
    
//     this.usage[providerId] += bytes;
//     this.saveUsage();
    
//     // Проверка превышения лимита
//     this.checkLimit(providerId);
//   }
  
//   // Проверка состояния лимита
//   checkLimit(providerId: string): boolean {
//     const usage = this.usage[providerId] || 0;
//     const limit = this.limits[providerId] || 0;
    
//     const percentUsed = (usage / limit) * 100;
    
//     // Вывод предупреждений
//     if (percentUsed > 95) {
//       console.warn(`✅ Лимит почти исчерпан!`, providerId, percentUsed, '%');
//       return true;
//     } else if (percentUsed > 90) {
//       console.warn(`⚠️ Лимит превышает 90%!`, providerId, percentUsed, '%');
//       return true;
//     }
    
//     return false;
//   }
  
//   // Получение информации о лимите
//   getLimitInfo(providerId: string): LimitInfo {
//     const usage = this.usage[providerId] || 0;
//     const limit = this.limits[deviderId] || 0;
    
//     return {
//       providerId,
//       used: usage,
//       limit,
//       percentUsed: (usage / limit) * 100,
//       remaining: limit - usage
//     };
//   }
  
//   // Проверка доступности провайдера
//   isProviderAvailable(providerId: string): boolean {
//     const info = this.getLimitInfo(providerId);
//     return info.remaining > 0;
//   }
  
//   // Сохранение данных
//   private saveUsage(): void {
//     // Логика сохранения использования
//   }
  
//   private saveLimits(): void {
//     // Логика сохранения лимитов
//   }
// }