export interface CurrentOperatorPort {
  getCurrentOperator(): Promise<{ id: string; role: string } | null>
  isAuthenticated(): Promise<boolean>
  getCurrentUserId(): Promise<string | null>
  getCurrentUserRole(): Promise<string | null>
}